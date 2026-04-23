import { getTypeColor } from "./mappingStatisticsData";

export default function MappingTypeLegend({ items, legendRef = null }) {
  return (
    <div
      ref={legendRef}
      className="mapping-type-legend"
      aria-label="RNA type legend"
    >
      {items.map((item, index) => (
        <div className="mapping-type-legend__item" key={item.type}>
          <span
            className="mapping-type-legend__swatch"
            style={{ backgroundColor: getTypeColor(item.type, index) }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
