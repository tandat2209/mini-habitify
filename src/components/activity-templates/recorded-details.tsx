import {
  detailsForDisplay,
  type Details,
} from "@/features/activity-templates/validation";
import type { TemplateVersion } from "@/features/activity-templates/types";
export function RecordedDetails({
  version,
  details,
}: {
  version?: TemplateVersion;
  details: Details;
}) {
  if (!version || Object.keys(details).length === 0) return null;
  return (
    <div className="recorded-details">
      <p className="muted text-xs">Details · version {version.version}</p>
      <dl>
        {detailsForDisplay(version.fields, details).map((item) => (
          <div key={item.key}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
