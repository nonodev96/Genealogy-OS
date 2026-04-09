import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: "root" })
export class PwaService {
	private deferredPrompt: BeforeInstallPromptEvent | null = null;

	readonly canInstall$ = new BehaviorSubject<boolean>(false);

	constructor() {
		this.registerServiceWorker();
		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			this.deferredPrompt = e as BeforeInstallPromptEvent;
			this.canInstall$.next(true);
		});
		window.addEventListener("appinstalled", () => {
			this.deferredPrompt = null;
			this.canInstall$.next(false);
		});
	}

	async install(): Promise<void> {
		if (!this.deferredPrompt) return;
		this.deferredPrompt.prompt();
		await this.deferredPrompt.userChoice;
		this.deferredPrompt = null;
		this.canInstall$.next(false);
	}

	private registerServiceWorker(): void {
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker
				.register("/ngsw-worker.js")
				.catch((err) =>
					console.warn("Service worker registration failed:", err),
				);
		}
	}
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): void;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
