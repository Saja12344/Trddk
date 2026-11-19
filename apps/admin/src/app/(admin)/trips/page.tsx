import { redirect } from "next/navigation";

export default function TripsRedirect() {
  redirect("/operations?tab=log");
}
