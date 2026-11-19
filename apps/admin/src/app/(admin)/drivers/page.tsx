import { redirect } from "next/navigation";

export default function DriversRedirect() {
  redirect("/operations?tab=now");
}
