import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  validateChartLesson,
  validateProcessLesson,
} from "@/lib/contracts/semantic-validation";
import {
  validateChartLessonShape,
  validateProcessLessonShape,
} from "@/lib/contracts/runtime-validation";

const fixtureRoot = join(process.cwd(), "fixtures");
const expectedIds = [
  "chart-bar-01",
  "chart-bar-02",
  "chart-line-01",
  "chart-line-02",
  "process-01",
  "process-02",
];

type Provenance = {
  schemaVersion: string;
  generator: { path: string; seed: string; version: string };
  license: { holder: string; spdx: string; statement: string };
  fixtures: Array<{
    challenge: string;
    gold: string;
    id: string;
    image: string;
    kind: string;
    mode: "chart" | "process";
  }>;
};

describe("owned deterministic fixtures", () => {
  it("records the exact six-fixture inventory and provenance", async () => {
    const provenance = JSON.parse(
      await readFile(join(fixtureRoot, "provenance.json"), "utf8"),
    ) as Provenance;

    expect(provenance).toMatchObject({
      schemaVersion: "1.0",
      generator: {
        path: "scripts/generate-fixtures.mjs",
        seed: "optiq-owned-fixtures-v1",
        version: "1.0.0",
      },
      license: {
        holder: "Optiq project",
        spdx: "CC0-1.0",
      },
    });
    expect(provenance.fixtures.map(({ id }) => id)).toEqual(expectedIds);
    expect(new Set(provenance.fixtures.map(({ id }) => id)).size).toBe(6);
    expect(provenance.fixtures.filter(({ mode }) => mode === "chart")).toHaveLength(4);
    expect(provenance.fixtures.filter(({ mode }) => mode === "process")).toHaveLength(
      2,
    );
    expect(provenance.fixtures.every(({ challenge }) => challenge.length > 20)).toBe(
      true,
    );
  });

  it("generates exactly six 1600 by 1000 PNG files", async () => {
    const images = (await readdir(join(fixtureRoot, "images"))).sort();
    expect(images).toEqual(expectedIds.map((id) => `${id}.png`));

    for (const image of images) {
      const imagePath = join(fixtureRoot, "images", image);
      const bytes = await readFile(imagePath);
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      await expect(sharp(imagePath).metadata()).resolves.toMatchObject({
        format: "png",
        height: 1000,
        width: 1600,
      });
    }
  });

  it("keeps every gold file aligned with runtime and semantic validation", async () => {
    const goldFiles = (await readdir(join(fixtureRoot, "gold"))).sort();
    expect(goldFiles).toEqual(expectedIds.map((id) => `${id}.json`));

    for (const goldFile of goldFiles) {
      const gold = JSON.parse(
        await readFile(join(fixtureRoot, "gold", goldFile), "utf8"),
      ) as unknown;
      const isChart = goldFile.startsWith("chart-");
      const syntax = isChart
        ? validateChartLessonShape(gold)
        : validateProcessLessonShape(gold);
      const semantics = isChart
        ? validateChartLesson(gold)
        : validateProcessLesson(gold);

      expect(syntax.success, `${goldFile} syntax`).toBe(true);
      expect(semantics.issues, `${goldFile} semantics`).toEqual([]);
      expect(semantics.valid, `${goldFile} semantics`).toBe(true);
    }
  });
});
