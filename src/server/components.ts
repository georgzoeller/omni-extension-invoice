import writeToCdn from './util/writeToCdn'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { platform } from 'os';
import { execFileSync } from 'child_process';


const sanitizeString = (str) => {
  if (str == null) {
    return undefined
  }
  str = str.trim();
  if (str.length > 255)   // arbitrary length limit
  {
    throw new Error('Input too long');
  }
  str = str.replace(/[;&|`'\\*?~<>^#$@\[\]\{\}]/g, '\\$&');

  return str;
}

const GenerateInvoiceComponent = {
  schema: {
    "tags": ['default'],
    "componentKey": "generateInvoice",
    "operation": {
      "schema": {
        "title": "Generate Invoice",
        "type": "object",
        "required": ["tax", "from", "to", "items"],
        "properties": {
          "title":
          {
            "title": "title",
            "type": "string",
            "x-type": "text",
            "default": "Invoice",
            "description": "Title",
          },
          "from": {
            "title": "From",
            "type": "string",
            "x-type": "text",
            "description": "The issuer of the invoice.",
          },
          "to": {
            "title": "To",
            "type": "string",
            "x-type": "text",
            "description": "The receiver of the invoice.",
          },
          "note": {
            "title": "Note",
            "type": "string",
            "x-type": "text",
            "description": "A note for the invoice.",
          },
          "tax": {
            "title": "Tax",
            "type": "number",
            "description": "The tax rate for the invoice.",
          },
          "id": {
            "title": "Number",
            "type": "string",
            "x-type": "text",
            "description": "The invoice number (defaults to the current date).",
          },
          "currency": {
            "title": "Currency",
            "type": "string",
            "x-type": "text",
            "description": "The currency for the invoice.",
          },
          "logo": {
            "title": "Logo",
            "type": "object",
            "x-type": "image",
            "description": "The logo for the invoice."
          },
          "due": {
            "title": "Due Date",
            "type": "string",
            "description": "The due date for the invoice (defaults to the current date + 1 month)."
          },
          "items": {
            "title": "Items",
            "type": "string",
            "x-type": "text",
            "description": "The items for the invoice in the following format - quantity x item [$ rate], e.g., 10x Rubber Duck [$ 25]. If no quantity is mentioned, 1 is assumed.",
          },
        },
      },
      "responseTypes": {
        "200": {
          "schema": {
            "title": "Invoice",
            "required": [
              "json",
              "pdf"
            ],
            "type": "object",
            "properties": {
              "json": {
                "title": "JSON",
                "type": "object",
                "description": "The JSON object for the invoice."
              },
              "pdf": {
                "title": "PDF",
                "type": "object",
                "x-type": "document",
                "description": "The PDF document for the invoice."
              },
            },
          },
          "contentType": "application/json"
        },
      },
      "method": "X-CUSTOM"
    },
    patch: {
      "title": "Generate Invoice (Invoice)",
      "category": "Invoice Generation",
      "summary": "Generates an invoice",
      "meta": {
        "source": {
          "summary": "Generate an invoice using the external invoice binary",
          links: {
            "Invoice Github": "https://github.com/invoice/invoice",
            "Support Invoice": "https://opencollective.com/invoice"
          }
        }
      },
      outputs: {
        "json": {
          "type": "object",
          "title": "JSON",
          "description": "The JSON object for the invoice.",

        },
        "pdf": {
          "type": "object",
          "x-type": "document",
          "title": "PDF",
          "description": "The PDF document for the invoice.",
        },
        "total": {
          "type": "number",
          "title": "Invoice Total",
          "description": "The sum of all items and tax in the invoice",
        },
        "taxtotal": {
          "type": "number",
          "title": "Tax Total",
          "description": "The tax on the invoice",
        },
        "itemTotal": {
          "type": "number",
          "title": "Item Total",
          "description": "The sum of all items in the invoice",
        }
      },
      inputs: {
        "tax": {



          "minimum": 0,
          "maximum": 1,
          "step": 0.01,
          "default": 0,
          "control": {
            "type": "AlpineNumWithSliderComponent"
          }
        },
        "from": {

          "x-type": "text",
          "required": true,
          "control": {
            "type": "AlpineTextComponent"
          }
        },
        "title": {
          "x-type": "text",
          "default": "Invoice",
          "control": {
            "type": "AlpineTextComponent"
          }
        },
        "to": {
          "x-type": "text",
          "required": true,
          "control": {
            "type": "AlpineTextComponent"
          }
        },
        "currency": {
          "x-type": "text",
          "default: ": "USD",
          "required": true,
          "control": {
            "type": "AlpineTextComponent"
          }
        },
        "note": {
          "x-type": "text",
          "control": {
            "type": "AlpineTextComponent"
          }
        },
        "logo": {
          "x-type": "image",
          "description": "The logo for the invoice.",
          "control": {
            "type": "AlpineLabelComponent"
          }
        },
        "items": {
          "x-type": "text",
          "required": true,
          "control": {
            "type": "AlpineTextComponent"
          }
        }
      }
    }
  },
  functions: {
    _exec: async (payload, ctx) => {
      let { tax, from, to, note, logo, items, currency, id, due, title } = payload;
      title = sanitizeString(title)
      from = sanitizeString(from)
      to = sanitizeString(to)
      note = sanitizeString(note)
      currency = sanitizeString(currency)
      id = sanitizeString(id) || new Date(Date.now()).toISOString().split('T')[0]
      due = sanitizeString(due)
      let total = 0
      let itemTotal = 0
      let taxTotal = 0

      // convert items to JSON
      const itemsArray = items.split('\n').map(item => {
        let quantity = 1;
        let rate;
        let itemName = item

        if (item.split('x ').length > 1) {
          quantity = parseInt(item.split('x ')[0]);
          itemName = item.split('x ')[1];
        }

        let rateRegExp = /\[(.*?)\]/;  // non-greedy match inside square brackets
        let match = itemName.match(rateRegExp);
        if (match) {

          rate = parseFloat(match[1].replace(/[^0-9\.,]/g, ''));
          itemName = itemName.replace(match[0], '').trim();
        }
        else {
          throw new Error("Rate missing from item " + itemName)
        }

        itemName = sanitizeString(itemName)

        return { quantity, itemName, rate };
      });

      itemTotal = itemsArray.reduce((acc, item) => acc + item.quantity * item.rate, 0)
      taxTotal = itemTotal * tax
      total = itemTotal + taxTotal


      const invoiceJson = {
        from,
        to,
        tax,
        id,
        note,
        items: itemsArray,
        itemTotal,
        taxTotal,
        total,
        due,
        title,
        currency,
        logo: logo?.url || undefined
      };
      const jsonFileName = Date.now() + '.json';


      const isWindows = platform() === 'win32';
      const executable = isWindows ? 'invoice.exe' : 'invoice';
      let invoicePath = path.join(__dirname, '..', 'bin', executable)

      let args = ['generate']
      if (note?.length > 0) {
        args.push('--note')
        args.push(note)
      }
      args.push('--from')
      args.push(from)
      args.push('--to')
      args.push(to)
      invoiceJson.items.forEach((item, index) => {
        args.push('--item')
        args.push(item.itemName)
        args.push('--quantity')
        args.push(item.quantity)
        args.push('--rate')
        args.push(item.rate)
      })

      if (id?.length > 0) {
        args.push('--id')
        args.push(id)
      }

      if (title?.length > 0) {
        args.push('--title')
        args.push(title)
      }

      args.push('--tax')
      args.push(tax)

      if (currency?.length > 0) {
        args.push('--currency')
        args.push(currency)
      }

      if (due?.length > 0) {
        args.push('--due')
        args.push(due)
      }

      let logoFid = logo?.fid || logo?.ticket.fid
      let cleanupFunction: Function | undefined = undefined
      if (logoFid) {
        // Get the file from the CDN as a temp file
        const logoFile = await ctx.app.cdn.getByFid(logoFid, undefined, 'file');
        const { path, fd, cleanup } = logoFile.data
        console.log(path)
        cleanupFunction = cleanup
        const logoFilePath = path
        args.push('--logo')
        args.push(logoFilePath)
      }

      const resultPath = path.join(__dirname, '..', 'bin')
      const invoiceFileName = ctx.userId + Date.now() + '.pdf';

      args.push('--output')
      args.push(path.join(resultPath, invoiceFileName))

      //  Cap input at maximum command line length
      if (invoiceFileName.length + args.join(' ').length > 8192) {
        throw new Error("Input too long")
      }

      // Execute
      execFileSync(invoicePath, args);

      // read the pdf file into a buffer and write to CDN
      const invoicePdfBuffer = await fs.readFile(path.join(resultPath, invoiceFileName));
      const invoice = await writeToCdn(ctx, [{ data: invoicePdfBuffer, mimeType: 'application/pdf', fileName: `${title} - ${id} - ${to}.pdf` }]);

      // If we created a temp file, kill it
      try {
        // Remove TempFile
        await cleanupFunction?.()
        await fs.unlink(path.join(resultPath, invoiceFileName))
      }
      catch (ex) {
        console.log("Error cleaning up temp file", ex)
      }
      return { json: invoiceJson, pdf: invoice, total, itemTotal, taxTotal };
    }
  }
}


let components = [GenerateInvoiceComponent]


export default (FactoryFn: any) => {
  return components.map((c: any) => FactoryFn(c.schema, c.functions))
}
