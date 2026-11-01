import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import CropGuide from "@/components/CropGuide";
import { getCropBySlug, getCrops } from "@/lib/server-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const crop = getCropBySlug(slug);
  if (!crop) return { title: "Crop not found" };
  return {
    title: `${crop.name} (${crop.scientificName}) — Crop Guide`,
    description: `Complete 15-section growing guide for ${crop.name}: climate, soil, irrigation, nutrients, pests, diseases, harvesting and economics.`,
  };
}

export async function generateStaticParams() {
  return getCrops().map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export default async function CropPage({ params }: Props) {
  const { slug } = await params;
  const crop = getCropBySlug(slug);
  if (!crop) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        href="/recommend"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        <ArrowLeft size={15} /> Crop Recommendation
      </Link>
      <CropGuide crop={crop} />
    </div>
  );
}