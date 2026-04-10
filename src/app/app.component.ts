import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { PaletteService } from "@core/services/palette.service";

@Component({
	selector: "app-root",
	imports: [RouterOutlet],
	templateUrl: "./app.component.html",
	styles: [`:host { display: block; height: 100vh; }`],
})
export class AppComponent {
	// Eagerly inject PaletteService so the global palette is loaded and applied
	// to document.documentElement as soon as the app bootstraps.
	readonly paletteService = inject(PaletteService);
}
