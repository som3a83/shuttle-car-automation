# Parametric CAD reference models

This folder contains editable OpenSCAD solid models for the Shuttle Car Automation engineering workspace.

## Files

- shuttle_car_reference.scad — a generic pallet-shuttle reference assembly with chassis, deck, cross-members, traction wheels, drive housings, a removable battery tray, guide rollers and sensor pods.
- lithium_battery_pack_reference.scad — a generic lithium-pack reference assembly with enclosure, prismatic cell placeholders, bus bars, BMS placeholder, terminals, service connector, handles and cover.

## Units, provenance and limitations

OpenSCAD uses millimetres. The default parameters are illustrative design-study values selected to make coherent editable solid models. They are not measured or verified dimensions for any installed Cassioli, Craftsman or ACME shuttle or battery. The geometry is manufacturer-neutral and must not be presented as an OEM drawing, fit-check model, service drawing, safety validation, or fabrication release.

Before using these models for design review or manufacturing:

1. Obtain the exact equipment model, revision and serial-number-specific manufacturer drawings.
2. Replace every illustrative parameter with approved values and tolerances.
3. Add missing manufacturer-specific mechanisms, fasteners, cable routing, safety devices and clearances.
4. Have the completed model reviewed and signed off by a qualified mechanical engineer and the equipment manufacturer where required.
5. Validate the physical assembly and safety requirements independently.

The application viewer remains a lightweight interactive reference visualization; these OpenSCAD files are the editable parametric CAD source. They do not connect to or control a physical shuttle.

## Open and export

Install OpenSCAD and open either source file. Press F5 for preview or F6 for full render. Export the selected model as STL using File → Export → Export as STL.

GitHub Actions validates both source files by rendering STL outputs and publishes them as the shuttle-parametric-cad-reference workflow artifact. Those STLs are reference geometry, not an engineering release.
