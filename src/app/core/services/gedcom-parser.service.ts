import { Injectable } from "@angular/core";
import type { Person, Relation, RelationType } from "../models";

export interface GedcomParseResult {
	persons: Person[];
	relations: Relation[];
}

interface RawIndi {
	id: string;
	name?: string;
	sex?: string;
	birthDate?: string;
	deathDate?: string;
	note?: string;
}

interface RawFam {
	id: string;
	husb?: string;
	wife?: string;
	chil: string[];
	marDate?: string;
	divDate?: string;
}

@Injectable({ providedIn: "root" })
export class GedcomParserService {
	parse(text: string): GedcomParseResult {
		const lines = text.split(/\r?\n/);
		const indis = new Map<string, RawIndi>();
		const fams = new Map<string, RawFam>();

		let currentIndi: RawIndi | null = null;
		let currentFam: RawFam | null = null;
		let inBirt = false;
		let inDeat = false;
		let inNote = false;

		for (const raw of lines) {
			const line = raw.trim();
			if (!line) continue;

			const m = line.match(/^(\d+)\s+(\S+)(?:\s+(.*))?$/);
			if (!m) continue;

			const level = Number(m[1]);
			const tag = m[2].toUpperCase();
			const value = m[3]?.trim() ?? "";

			// Reset sub-record flags on new level-0 or level-1 record
			if (level <= 1) {
				inBirt = false;
				inDeat = false;
				inNote = false;
			}

			if (level === 0) {
				currentIndi = null;
				currentFam = null;

				if (tag.startsWith("@") && value === "INDI") {
					const xref = tag.replace(/@/g, "");
					currentIndi = { id: xref, chil: undefined } as unknown as RawIndi;
					indis.set(xref, currentIndi);
				} else if (tag.startsWith("@") && value === "FAM") {
					const xref = tag.replace(/@/g, "");
					currentFam = { id: xref, chil: [] };
					fams.set(xref, currentFam);
				}
				continue;
			}

			if (currentIndi) {
				if (level === 1) {
					if (tag === "NAME") {
						currentIndi.name = value.replace(/\//g, "").trim();
					} else if (tag === "SEX") {
						currentIndi.sex = value.toUpperCase();
					} else if (tag === "BIRT") {
						inBirt = true;
						inDeat = false;
					} else if (tag === "DEAT") {
						inDeat = true;
						inBirt = false;
					} else if (tag === "NOTE") {
						inNote = true;
						currentIndi.note = value;
					}
				} else if (level === 2) {
					if (tag === "DATE") {
						const parsed = this.parseDate(value);
						if (inBirt) currentIndi.birthDate = parsed;
						else if (inDeat) currentIndi.deathDate = parsed;
					} else if (tag === "CONT" && inNote) {
						currentIndi.note = (currentIndi.note ?? "") + "\n" + value;
					}
				}
				continue;
			}

			if (currentFam) {
				if (level === 1) {
					if (tag === "HUSB")
						currentFam.husb = value.replace(/@/g, "");
					else if (tag === "WIFE")
						currentFam.wife = value.replace(/@/g, "");
					else if (tag === "CHIL")
						currentFam.chil.push(value.replace(/@/g, ""));
					else if (tag === "MARR") {
						inBirt = false;
						inDeat = false;
					} else if (tag === "DIV") {
						inBirt = false;
						inDeat = false;
					}
				} else if (level === 2 && tag === "DATE") {
					// marriage/divorce date captured if needed
				}
			}
		}

		// Convert raw records to domain models
		const now = new Date().toISOString();
		const idMap = new Map<string, string>(); // xref → uuid

		const persons: Person[] = [];
		for (const [xref, raw] of indis) {
			const uuid = crypto.randomUUID();
			idMap.set(xref, uuid);
			const gender = this.mapGender(raw.sex);
			persons.push({
				id: uuid,
				name: raw.name ?? xref,
				gender,
				birthDate: raw.birthDate,
				deathDate: raw.deathDate,
				notes: raw.note,
				createdAt: now,
				updatedAt: now,
			});
		}

		const relations: Relation[] = [];
		for (const fam of fams.values()) {
			const husbId = fam.husb ? idMap.get(fam.husb) : undefined;
			const wifeId = fam.wife ? idMap.get(fam.wife) : undefined;

			// Partner relation
			if (husbId && wifeId) {
				relations.push({
					id: crypto.randomUUID(),
					from: husbId,
					to: wifeId,
					type: "partnerOf" as RelationType,
				});
			}

			// Parent → child relations
			for (const chilXref of fam.chil) {
				const chilId = idMap.get(chilXref);
				if (!chilId) continue;
				if (husbId) {
					relations.push({
						id: crypto.randomUUID(),
						from: husbId,
						to: chilId,
						type: "parentOf" as RelationType,
					});
				}
				if (wifeId) {
					relations.push({
						id: crypto.randomUUID(),
						from: wifeId,
						to: chilId,
						type: "parentOf" as RelationType,
					});
				}
			}
		}

		return { persons, relations };
	}

	parseFile(file: File): Promise<GedcomParseResult> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				try {
					resolve(this.parse(reader.result as string));
				} catch (e) {
					reject(e);
				}
			};
			reader.onerror = () => reject(new Error("Failed to read GEDCOM file"));
			reader.readAsText(file, "utf-8");
		});
	}

	private parseDate(value: string): string | undefined {
		if (!value) return undefined;
		// Try to extract year from GEDCOM date strings like "12 JUN 1985" or "1985"
		const yearMatch = value.match(/\b(\d{4})\b/);
		if (!yearMatch) return undefined;
		const year = yearMatch[1];
		const months: Record<string, string> = {
			JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
			JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
		};
		const monthMatch = value.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i);
		const month = monthMatch ? months[monthMatch[1].toUpperCase()] : undefined;
		const dayMatch = value.match(/\b(\d{1,2})\s+\w{3}/);
		const day = dayMatch ? dayMatch[1].padStart(2, "0") : undefined;
		if (month && day) return `${year}-${month}-${day}`;
		if (month) return `${year}-${month}`;
		return year;
	}

	private mapGender(sex?: string): Person["gender"] {
		if (!sex) return "unknown";
		switch (sex.toUpperCase()) {
			case "M": return "male";
			case "F": return "female";
			default: return "other";
		}
	}
}
