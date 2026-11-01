import HomeClient from "@/components/HomeClient";
import { getCourseIndex, getCrops } from "@/lib/server-data";

export default function HomePage() {
  const courses = getCourseIndex();
  const crops = getCrops();
  return <HomeClient courses={courses} crops={crops} />;
}