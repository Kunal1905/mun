import { Compass } from "lucide-react";
import { Link } from "react-router";
import { Button, EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <EmptyState icon={<Compass className="size-6" />} title="This chamber is empty">
        The page you are looking for has adjourned.
        <div className="mt-5">
          <Link to="/">
            <Button>Back to the lobby</Button>
          </Link>
        </div>
      </EmptyState>
    </div>
  );
}
