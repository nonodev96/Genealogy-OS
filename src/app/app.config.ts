import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { APP_ROUTES } from './app.routes';
import { MatNativeDateModule } from '@angular/material/core';
import { provideTranslateService } from "@ngx-translate/core";
import { provideTranslateHttpLoader } from "@ngx-translate/http-loader";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(APP_ROUTES, withHashLocation()),
    importProvidersFrom(MatNativeDateModule),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideTranslateService({
      fallbackLang: 'es',
      lang: 'es',
      useDefaultLang: true,
      defaultLanguage: 'es',
      loader: provideTranslateHttpLoader({
        prefix: 'assets/i18n/',
        suffix: '.json'
      }),
    })
  ]
};
