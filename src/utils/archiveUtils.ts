import JSZip from "jszip";

function shouldStripGitEntry(path: string): boolean {
    if (!path) return false;
    const normalized = path.replace(/\\/g, "/");
    return (
        normalized === ".git" ||
        normalized === ".git/" ||
        normalized.startsWith(".git/") ||
        normalized.includes("/.git/") ||
        normalized.endsWith("/.git") ||
        normalized.endsWith("/.git/")
    );
}

export async function stripGitFromArchive(blob: Blob): Promise<Blob> {
    if (!(blob instanceof Blob)) {
        throw new TypeError("stripGitFromArchive expects a Blob input.");
    }

    const zip = await JSZip.loadAsync(blob);
    const entries = Object.keys(zip.files);

    entries.forEach((entryPath) => {
        if (shouldStripGitEntry(entryPath)) {
            zip.remove(entryPath);
        }
    });

    return zip.generateAsync({ type: "blob" });
}
