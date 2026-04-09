import {
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	type OnChanges,
	type OnDestroy,
	type SimpleChanges,
	ViewChild,
	input,
	output,
} from "@angular/core";
import * as d3 from "d3";
import type { Person } from "@core/models";

interface TimelineBar {
	person: Person;
	startYear: number;
	endYear: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const BAR_H = 22;
const BAR_GAP = 8;
const LABEL_W = 130;
const PADDING = { top: 30, right: 20, bottom: 40, left: 10 };

function extractYear(date?: string): number | null {
	if (!date) return null;
	const m = date.match(/(\d{4})/);
	return m ? Number(m[1]) : null;
}

@Component({
	selector: "app-timeline",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <div class="tl-wrap">
      <svg #svgEl class="tl-svg" role="img" aria-label="Family timeline"></svg>
      <div class="tl-tooltip" #tooltip style="display:none" aria-hidden="true"></div>
    </div>
  `,
	styles: [`
    :host { display:block; width:100%; height:100%; overflow:hidden; }
    .tl-wrap { position:relative; width:100%; height:100%; overflow:auto; }
    .tl-svg { display:block; }
    .tl-tooltip {
      position:fixed; z-index:9999;
      background:#1c1c1c; border:1px solid rgba(255,51,51,0.4);
      color:#f0f0f0; font-family:monospace; font-size:11px;
      padding:6px 10px; border-radius:3px; pointer-events:none;
      white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.5);
    }
  `],
})
export class TimelineComponent implements OnChanges, OnDestroy {
	readonly persons = input<Person[]>([]);
	readonly personClick = output<string>();

	@ViewChild("svgEl", { static: true }) svgRef!: ElementRef<SVGSVGElement>;
	@ViewChild("tooltip", { static: true }) tooltipRef!: ElementRef<HTMLDivElement>;

	private resizeObserver?: ResizeObserver;

	ngOnChanges(_changes: SimpleChanges): void {
		this.render();
	}

	ngOnDestroy(): void {
		this.resizeObserver?.disconnect();
	}

	private render(): void {
		const persons = this.persons();
		const svgEl = this.svgRef.nativeElement;
		const tooltip = this.tooltipRef.nativeElement;

		d3.select(svgEl).selectAll("*").remove();

		const bars: TimelineBar[] = persons
			.map((p) => {
				const startYear = extractYear(p.birthDate);
				if (!startYear) return null;
				const endYear = extractYear(p.deathDate) ?? CURRENT_YEAR;
				return { person: p, startYear, endYear };
			})
			.filter((b): b is TimelineBar => b !== null)
			.sort((a, b) => a.startYear - b.startYear);

		if (bars.length === 0) {
			d3.select(svgEl)
				.append("text")
				.attr("x", 20)
				.attr("y", 40)
				.attr("fill", "rgba(255,255,255,0.3)")
				.attr("font-family", "monospace")
				.attr("font-size", 12)
				.text("No birth dates available for timeline");
			return;
		}

		const containerW = svgEl.parentElement?.clientWidth ?? 600;
		const svgH =
			PADDING.top + bars.length * (BAR_H + BAR_GAP) + PADDING.bottom;
		const svgW = Math.max(containerW, 400);
		const chartW = svgW - LABEL_W - PADDING.right - PADDING.left;

		const minYear = d3.min(bars, (b) => b.startYear) ?? CURRENT_YEAR - 100;
		const maxYear = d3.max(bars, (b) => b.endYear) ?? CURRENT_YEAR;
		const yearPad = Math.max(5, Math.round((maxYear - minYear) * 0.05));

		const xScale = d3
			.scaleLinear()
			.domain([minYear - yearPad, maxYear + yearPad])
			.range([0, chartW]);

		const svg = d3
			.select(svgEl)
			.attr("width", svgW)
			.attr("height", svgH);

		// Background
		svg.append("rect")
			.attr("width", svgW)
			.attr("height", svgH)
			.attr("fill", "#111");

		// Axis
		const axisG = svg
			.append("g")
			.attr("transform", `translate(${LABEL_W + PADDING.left},${PADDING.top - 8})`);

		const xAxis = d3.axisTop(xScale).ticks(8).tickFormat(d3.format("d"));
		axisG.call(xAxis as d3.Axis<d3.NumberValue>);
		axisG.selectAll("text").attr("fill", "rgba(255,255,255,0.5)").attr("font-size", 10);
		axisG.selectAll("line,path").attr("stroke", "rgba(255,255,255,0.15)");

		// Grid lines
		const gridG = svg
			.append("g")
			.attr("transform", `translate(${LABEL_W + PADDING.left},${PADDING.top})`);
		const ticks = xScale.ticks(8);
		gridG
			.selectAll("line.grid")
			.data(ticks)
			.join("line")
			.attr("class", "grid")
			.attr("x1", (d) => xScale(d))
			.attr("x2", (d) => xScale(d))
			.attr("y1", 0)
			.attr("y2", bars.length * (BAR_H + BAR_GAP))
			.attr("stroke", "rgba(255,255,255,0.06)")
			.attr("stroke-width", 1);

		// Bars group
		const barsG = svg
			.append("g")
			.attr("transform", `translate(${LABEL_W + PADDING.left},${PADDING.top})`);

		// Gender colors
		const genderColor = (g?: string): string => {
			switch (g) {
				case "male": return "#4a90d9";
				case "female": return "#e87ea1";
				default: return "#8a8a8a";
			}
		};

		bars.forEach((bar, i) => {
			const y = i * (BAR_H + BAR_GAP);
			const x = xScale(bar.startYear);
			const w = Math.max(2, xScale(bar.endYear) - xScale(bar.startYear));
			const color = genderColor(bar.person.gender);
			const isAlive = !bar.person.deathDate;

			// Row background
			barsG
				.append("rect")
				.attr("x", -LABEL_W)
				.attr("y", y)
				.attr("width", svgW)
				.attr("height", BAR_H)
				.attr("fill", i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent");

			// Name label
			svg
				.append("text")
				.attr("x", PADDING.left + LABEL_W - 6)
				.attr("y", PADDING.top + y + BAR_H / 2 + 4)
				.attr("text-anchor", "end")
				.attr("fill", "rgba(255,255,255,0.7)")
				.attr("font-family", "monospace")
				.attr("font-size", 10)
				.text(bar.person.name.length > 16 ? `${bar.person.name.slice(0, 14)}…` : bar.person.name);

			// Bar
			const rect = barsG
				.append("rect")
				.attr("x", x)
				.attr("y", y + 2)
				.attr("width", w)
				.attr("height", BAR_H - 4)
				.attr("rx", 2)
				.attr("fill", isAlive ? `${color}cc` : `${color}88`)
				.attr("stroke", color)
				.attr("stroke-width", 1)
				.style("cursor", "pointer")
				.attr("tabindex", "0")
				.attr("role", "button")
				.attr("aria-label", `${bar.person.name} ${bar.startYear}–${bar.endYear}`);

			// Hover
			rect
				.on("mouseenter", (event: MouseEvent) => {
					d3.select(event.currentTarget as Element).attr("fill", color);
					const dateStr = bar.person.deathDate
						? `${bar.startYear} – ${bar.endYear}`
						: `${bar.startYear} – present`;
					tooltip.style.display = "block";
					tooltip.innerHTML = `<strong>${bar.person.name}</strong><br/>${dateStr}`;
				})
				.on("mousemove", (event: MouseEvent) => {
					tooltip.style.left = `${event.clientX + 12}px`;
					tooltip.style.top = `${event.clientY - 8}px`;
				})
				.on("mouseleave", (event: MouseEvent) => {
					d3.select(event.currentTarget as Element).attr("fill", isAlive ? `${color}cc` : `${color}88`);
					tooltip.style.display = "none";
				})
				.on("click", () => {
					this.personClick.emit(bar.person.id);
				})
				.on("keydown", (event: KeyboardEvent) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						this.personClick.emit(bar.person.id);
					}
				});

			// Year labels inside bar if wide enough
			if (w > 40) {
				barsG
					.append("text")
					.attr("x", x + 4)
					.attr("y", y + BAR_H / 2 + 4)
					.attr("fill", "rgba(255,255,255,0.8)")
					.attr("font-family", "monospace")
					.attr("font-size", 9)
					.text(String(bar.startYear))
					.style("pointer-events", "none");
			}
		});
	}
}
