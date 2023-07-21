
import CreateComponents from './components'
import {promises as fs} from 'fs'
import { createWriteStream } from 'fs';
import path from 'path'
import { fileURLToPath } from 'url';
import os from 'os';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if the binary exists
async function checkIfBinaryExists(directory) {
  const platform = os.platform();
  const binaryName = platform === 'win32' ? 'invoice.exe' : 'invoice';
  const binaryPath = path.join(directory, binaryName);

  try {
    await fs.access(binaryPath);
    return true;
  } catch {
    return false;
  }
}


async function downloadAndExtract(app:any, directory:string, version = '0.1.0') {


  const platform = os.platform();
  const arch = os.arch();

  const platformMap = {
    'win32': 'windows',
    'darwin': 'darwin',
    'linux': 'linux'
  };

  const archMap = {
    'x32': '386',
    'x64': 'amd64',
    'arm64': 'arm64'
  };

  const platformName = platformMap[platform];
  const archName = archMap[arch];

  const url = `https://github.com/maaslalani/invoice/releases/download/v${version}/invoice_${version}_${platformName}_${archName}.tar.gz`;

  try {

    const { data } = await axios.get(url, { responseType: 'stream' });
    const writer = createWriteStream(`${directory}/invoice.tar.gz`);

    data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Extract the binary
    console.log(await app.utils.tar.x({
      file: `${directory}/invoice.tar.gz`,
      cwd: directory
    }))

    await fs.unlink(`${directory}/invoice.tar.gz`); // Remove the downloaded tar file

  } catch (err) {
    console.error(`Error downloading or extracting file: ${err}`, directory);
    throw err;
  }
}



const validateBinary = async function (ctx: {app: any})
{
  const executablePath = path.join(process.cwd(), 'extensions', 'omni-extension-invoice', 'bin')

  if (!await checkIfBinaryExists(executablePath)) {
    console.log('omni-extension-invoice: Binary not found, downloading and extracting to...');
    await downloadAndExtract(ctx.app, executablePath)
  }
  else
  {
    console.log("=====binary found")
  }

}






const extensionHooks = {

  'extensions_loaded': validateBinary


}

export default {hooks: extensionHooks, createComponents: CreateComponents}



