export const formatDate = (iso: string): string => {
	const date = new Date(iso);

	return date.toLocaleString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};
