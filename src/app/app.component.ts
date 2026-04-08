import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styles: [`:host { display: block; height: 100vh; }`],
})
export class AppComponent {
    private translate = inject(TranslateService);

    constructor() {
        this.translate.addLangs(['es', 'en']);
        this.translate.setFallbackLang('es');
        this.translate.use('es');
    }
}