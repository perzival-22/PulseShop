/**
 * Read a picked image File into a base64 data URL. Matches how ProductModal
 * stores product images — kept inline in the DB until a Storage bucket lands.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
