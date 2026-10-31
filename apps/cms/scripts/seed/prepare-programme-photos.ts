import { mkdir, readFile, writeFile } from "node:fs/promises";
import { searchEventPhotos, type EventPhoto } from "./seed-event-photos";

export const programmePhotoDirectory = "/tmp/poetry-programme-photos";

export async function prepareProgrammePhotos(): Promise<EventPhoto[]> {
  await mkdir(programmePhotoDirectory, { recursive: true });
  try {
    const cached = JSON.parse(
      await readFile(`${programmePhotoDirectory}/sources.json`, "utf8"),
    ) as EventPhoto[];
    if (cached.length === 12) {
      await Promise.all(
        cached.map((_, index) =>
          readFile(`${programmePhotoDirectory}/${index}.jpg`),
        ),
      );
      return cached;
    }
  } catch {
    /* A missing or incomplete cache is downloaded before database writes. */
  }
  const photos = await searchEventPhotos();
  for (const [index, photo] of photos.entries()) {
    const response = await fetch(photo.imageUrl, {
      headers: { "User-Agent": "PoetryProjectLocalEditorial/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/jpeg")
    )
      throw new Error(`Photo download failed: ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 5 * 1024 * 1024)
      throw new Error("Photo exceeds size limit");
    await writeFile(`${programmePhotoDirectory}/${index}.jpg`, data);
  }
  await writeFile(
    `${programmePhotoDirectory}/sources.json`,
    JSON.stringify(photos, null, 2),
  );
  return photos;
}
