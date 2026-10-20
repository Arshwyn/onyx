// Bar-weight quick-select chips, shared between PlateCalculator (the overlay itself)
// and SettingsView (the "Default Bar Weight" picker that seeds it). Split into its
// own module rather than exported from PlateCalculator.tsx, since a component file
// may only export components (react-refresh/only-export-components).
//
// The 45/35/25/15 (lbs) values are literal per the redesign spec; kg has no
// equivalent in the source spec, so those are the nearest common metric bar/plate
// weights rather than a direct unit conversion. A 0 ("None") option is added on top
// of the spec for plate-loaded machines (leg press, hack squat, etc.) that have no
// bar weight to subtract -- the old bar-type chips (None/Mach/EZ/Womens/Standard)
// covered this case and dropping it silently would leave those machines with no
// accurate way to get a per-side breakdown.
export const BAR_OPTIONS_LBS = [45, 35, 25, 15, 0];
export const BAR_OPTIONS_KG = [20, 15, 10, 5, 0];
