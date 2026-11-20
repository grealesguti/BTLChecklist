// Browser side: shrink photos before upload (longest side MAX_PX, JPEG), so phone photos of several
// MB become a few hundred kB. Used with `use:enhance={shrinkPhotos(...)}` on any form with 'photo' inputs.
const MAX_PX = 1600;
const QUALITY = 0.8;

export async function shrink(file) {
	try {
		const bmp = await createImageBitmap(file); // applies the EXIF rotation
		const k = Math.min(1, MAX_PX / Math.max(bmp.width, bmp.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bmp.width * k);
		canvas.height = Math.round(bmp.height * k);
		canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITY));
		return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
	} catch {
		return file; // a format the browser cannot decode: the server decides
	}
}

/** SubmitFunction for use:enhance: replaces every 'photo' file by its shrunk copy; `busy(true/false)` around it. */
export const shrinkPhotos = (busy = () => {}) => async ({ formData }) => {
	busy(true);
	const files = formData.getAll('photo').filter((f) => f instanceof File && f.size);
	formData.delete('photo');
	for (const f of files) formData.append('photo', await shrink(f));
	return async ({ update }) => {
		busy(false);
		await update();
	};
};
