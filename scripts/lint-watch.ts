import { spawn } from "bun";
import { watch } from "node:fs";

let timer: Timer | undefined;

const task = () => {
	spawn(["biome", "lint", "."], {
		stdout: "inherit",
		stderr: "inherit",
	});
};

watch(".", { recursive: true }, (_, file) => {
	if (!file) return;

	clearTimeout(timer);

	timer = setTimeout(() => {
		task();
	}, 100);
});

task();
