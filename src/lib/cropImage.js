// Turns a source image + a pixel crop rect (from react-easy-crop's
// onCropComplete) into a cropped image Blob, ready to upload. Output is
// capped so a huge upload doesn't come back as a multi-MB banner.
const MAX_W = 1600 // a 4:1 banner never needs more than this across

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}

// pixelCrop: { x, y, width, height } in the source image's natural pixels.
export async function getCroppedBlob(src, pixelCrop, type = 'image/jpeg') {
  const img = await loadImage(src)
  const scale = pixelCrop.width > MAX_W ? MAX_W / pixelCrop.width : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pixelCrop.width * scale)
  canvas.height = Math.round(pixelCrop.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, canvas.width, canvas.height,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      type,
      0.9,
    )
  })
}
