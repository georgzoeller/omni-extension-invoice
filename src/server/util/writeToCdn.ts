

// Writes an array of images objectsto the CDN
const writeToCdn = async (ctx: any, files: any, meta?:any) => {
  console.log("writeToCdn")

  return Promise.all(files.map(async (file: any) => {
    // Update image metadata
    // Write to CDN
    if (file.data != null)
    {
      let fileName = file.fileName
      return ctx.app.cdn.putTemp(file.data, { mimeType: file.mimeType, userId: ctx.userId, fileName }, Object.assign({}, file.meta, meta || {}, {user: ctx.userId}));
    }
    else
    {
      return file
    }
  }));
}
export default writeToCdn