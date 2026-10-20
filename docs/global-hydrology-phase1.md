# Global hydrology, Phase 1

## Method

Hydrology is derived from `planet-dem-global-1deg-v3`. A deterministic Priority-Flood first starts from every ocean cell and computes a separate minimum spill surface. Candidate interior sinks must be 8-neighbor minima, at least 180 m below their DEM-derived spill surface, and at least 450 km from the coast. Candidates are ranked by depression depth, separated by at least 400 km, and capped at 16. A second multi-source flood includes those candidate lake outlets.

The conditioned surface, D8 receiver index and visit rank are derived arrays; the original `Int16Array` DEM is never modified. Each receiver is a neighbor with no higher conditioned elevation and an earlier visit rank. The rank breaks ties on flats and strictly decreases along every land flow link, so loops cannot form. Longitude neighbors wrap at ±180°. Cell accumulation uses spherical cell area from the planet radius and latitude band, not a uniform planar pixel area.

The final outlet root labels each catchment cell. Outlets with ocean cells form ocean catchments; retained inland sinks form endorheic catchments. Stream cells are selected at 180,000 km² accumulated area, with reaches at 1,500,000 km² classified as main-channel reaches. Lake candidates are based on retained sink catchments with at least 20,000 km² of cells at least 80 m below their sea-connected spill level. Delta markers require a river mouth in ocean, at least 1,000,000 km² contributing area, and a low, gently sloping final land cell.

## Current DEM diagnostics and generated totals

On DEM v3 the ocean-only pass found 800 land cells requiring positive depression fill (maximum 297 m, mean 108.4 m across affected cells). After 16 candidate interior sinks are preserved as terminal outlets, the conditioned routing surface fills 522 cells (maximum 209 m, mean 54.2 m). There are 1,377 land cells adjacent to an equal-height land cell; visit ranks resolve their routing without introducing cycles. Land and sea elevations remain on the correct side of sea level according to the existing coastline mask.

The current generated layer contains 1,852 terminal catchments (1,836 ocean outlet cells and 16 retained endorheic outlets), 698 routed stream cells, 49 main-channel reaches, 89 tributary reaches, 14 derived lake markers, and 20 qualifying delta markers. A reach is an individually connected headwater/confluence-to-confluence line segment; `systemId` groups reaches sharing an outlet basin. These counts are deterministic for the current generator version and thresholds.

Hydrology computation measured about 250 ms after DEM v3 was already available in the current development environment. Rendering the 720×360 catchment overlay is performed on the client preview and remains a small one-time operation.

## Limitations

At 1° each cell is roughly 111 km north-south and about 111 km east-west at the equator, narrowing east-west toward the poles. The generated channels are global-scale drainage hypotheses, not accurate local rivers. D8 routing cannot represent sub-grid tributaries, braided channels, seasonal flow, karst, groundwater, artificial reservoirs, coastal estuary geometry, or detailed lake shorelines. Delta and lake shapes are markers generalized from candidate cells, not fine vector shorelines. The selected 16 sink outlets are heuristic candidates, not an authored geological claim. No climate, biome, political, or infrastructure layer is involved.
