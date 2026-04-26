const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Read a browser File into an evidence item stored in JSON (data URL).
 * @param {File} file
 * @returns {Promise<{ name: string, kind: string, mime: string, dataUrl: string }>}
 */
export function fileToEvidenceItem(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected."));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("File is too large (maximum 4 MB for inline evidence)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      resolve({
        name: file.name,
        kind: "upload",
        mime: file.type || "",
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
