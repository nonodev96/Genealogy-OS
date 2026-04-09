import type { Routes } from "@angular/router";

export const APP_ROUTES: Routes = [
	{
		path: "",
		redirectTo: "dashboard",
		pathMatch: "full",
	},
	{
		path: "dashboard",
		loadComponent: () =>
			import("./features/dashboard/dashboard.component").then(
				(m) => m.DashboardComponent,
			),
		title: "Mis árboles - GenealogíaApp",
	},
	{
		path: "tree/:id",
		loadComponent: () =>
			import("./features/tree-editor/tree-editor.component").then(
				(m) => m.TreeEditorComponent,
			),
		title: "Editor de árbol - GenealogíaApp",
	},
	{
		path: "collaborate",
		loadComponent: () =>
			import("./features/collaboration/collaborate.component").then(
				(m) => m.CollaborateComponent,
			),
		title: "Unirse al árbol - GenealogíaApp",
	},
	{
		path: "embed",
		loadComponent: () =>
			import("./features/embed/embed.component").then(
				(m) => m.EmbedComponent,
			),
		title: "Genealogy OS - Embedded Tree",
	},
	{
		path: "**",
		redirectTo: "dashboard",
	},
];
