import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
	selector: "app-root",
	imports: [RouterOutlet],
	templateUrl: "./app.component.html",
	styles: [`:host { display: block; height: 100vh; }`],
})
export class AppComponent {}
