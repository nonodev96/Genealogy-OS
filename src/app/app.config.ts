import {
	type ApplicationConfig,
	importProvidersFrom,
	provideBrowserGlobalErrorListeners,
	provideZoneChangeDetection,
} from "@angular/core";
import { MatNativeDateModule } from "@angular/material/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { provideTranslateService } from "@ngx-translate/core";
import { provideTranslateHttpLoader } from "@ngx-translate/http-loader";
import { APP_ROUTES } from "./app.routes";

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(APP_ROUTES, withHashLocation()),
		importProvidersFrom(MatNativeDateModule),
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideTranslateService({
			fallbackLang: "es",
			lang: "es",
			useDefaultLang: true,
			defaultLanguage: "es",
			loader: provideTranslateHttpLoader({
				prefix: "assets/i18n/",
				suffix: ".json",
			}),
		}),
	],
};
