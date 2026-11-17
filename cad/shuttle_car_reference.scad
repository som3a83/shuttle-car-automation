/*
  SHUTTLE CAR — PARAMETRIC ENGINEERING REFERENCE ASSEMBLY
  Units: millimetres (OpenSCAD native units).
  DEFAULT VALUES ARE ILLUSTRATIVE DESIGN-STUDY PARAMETERS, NOT OEM DIMENSIONS.
  This is not a Cassioli, Craftsman or ACME production drawing. Replace every default
  with verified manufacturer drawings before fabrication, fit checks or maintenance.
*/
$fn = 48;

// Editable reference parameters in mm. None are manufacturer-verified.
frame_length = 660;
deck_width = 310;
chassis_height = 36;
deck_thickness = 12;
wheel_diameter = 110;
wheel_width = 34;
wheel_axle_z = 54;
wheel_center_x = frame_length / 2 - 68;
wheel_center_y = deck_width / 2 + wheel_width / 2 - 3;
battery_length = 180;
battery_width = 150;
battery_height = 88;
exploded_view = false;
show_powertrain = true;
show_battery = true;
show_sensors = true;
show_fasteners = true;

module rounded_prism(length, width, height, radius = 8) {
  hull() {
    for (x = [-length / 2 + radius, length / 2 - radius])
      for (y = [-width / 2 + radius, width / 2 - radius])
        translate([x, y, 0]) cylinder(h = height, r = radius, center = true);
  }
}

module through_bolt(x, y, z, diameter = 8, height = 8) {
  translate([x, y, z])
    color([0.72, 0.78, 0.82]) cylinder(d = diameter, h = height, center = true);
}

module wheel_assembly(x, y, z) {
  translate([x, y, z]) {
    rotate([90, 0, 0]) {
      color([0.075, 0.09, 0.105]) cylinder(d = wheel_diameter, h = wheel_width, center = true);
      color([0.55, 0.62, 0.68]) cylinder(d = wheel_diameter * 0.48, h = wheel_width + 2, center = true);
      color([0.16, 0.22, 0.27]) cylinder(d = wheel_diameter * 0.26, h = wheel_width + 4, center = true);
    }
    if (show_fasteners)
      for (a = [0 : 45 : 315])
        translate([cos(a) * wheel_diameter * 0.17, y < 0 ? -wheel_width / 2 - 1 : wheel_width / 2 + 1, sin(a) * wheel_diameter * 0.17])
          rotate([90, 0, 0])
            color([0.8, 0.84, 0.87]) cylinder(d = 7, h = 3, center = true);
  }
}

module drive_motor(x, y, side = 1) {
  translate([x, y, 91 + (exploded_view ? 32 : 0)]) {
    color([0.18, 0.26, 0.32]) rounded_prism(112, 72, 62, 9);
    translate([0, side * 42, 0])
      rotate([90, 0, 0])
        color([0.72, 0.38, 0.16]) cylinder(d = 48, h = 24, center = true);
    for (p = [-1, 1])
      translate([p * 38, 0, -37])
        color([0.55, 0.62, 0.68]) cube([12, 54, 14], center = true);
  }
}

module battery_tray_reference() {
  translate([0, 0, 165 + (exploded_view ? 62 : 0)]) {
    color([0.13, 0.23, 0.24])
      difference() {
        rounded_prism(battery_length + 24, battery_width + 24, 16, 7);
        translate([0, 0, 5]) rounded_prism(battery_length, battery_width, 18, 5);
      }
    color([0.20, 0.35, 0.32]) translate([0, 0, 43]) rounded_prism(battery_length, battery_width, battery_height, 5);
    for (row = [-1, 1])
      for (col = [-1.5, -0.5, 0.5, 1.5])
        color([0.30, 0.58, 0.47])
          translate([col * 34, row * 31, 43]) cube([28, 48, 68], center = true);
    color([0.75, 0.45, 0.20])
      translate([battery_length / 2 - 22, 0, 88]) cube([26, 58, 10], center = true);
    color([0.12, 0.18, 0.22])
      translate([-battery_length / 2 + 18, 0, 88]) cube([34, 42, 16], center = true);
  }
}

module sensor_pod(x, y) {
  translate([x, y, 157 + (exploded_view ? 28 : 0)]) {
    color([0.16, 0.21, 0.25]) cylinder(d = 24, h = 25, center = true);
    translate([0, 0, 14]) color([0.35, 0.72, 0.83]) sphere(d = 17);
    color([0.78, 0.47, 0.18]) translate([0, 0, -15]) cylinder(d = 28, h = 5, center = true);
  }
}

module chassis_assembly() {
  translate([0, 0, 128 + (exploded_view ? -20 : 0)]) {
    color([0.25, 0.34, 0.40]) rounded_prism(frame_length, deck_width, chassis_height, 12);
    for (y = [-deck_width * 0.39, deck_width * 0.39])
      translate([0, y, -4])
        color([0.43, 0.52, 0.58]) cube([frame_length - 28, 25, 38], center = true);
    for (x = [-frame_length * 0.34, -frame_length * 0.12, frame_length * 0.12, frame_length * 0.34])
      translate([x, 0, -5])
        color([0.37, 0.46, 0.52]) cube([22, deck_width - 30, 40], center = true);
    for (y = [-deck_width * 0.46, deck_width * 0.46])
      translate([0, y, -21])
        color([0.70, 0.39, 0.17]) cube([frame_length - 12, 12, 10], center = true);
  }

  translate([0, 0, 152 + (exploded_view ? 8 : 0)]) {
    color([0.57, 0.65, 0.70])
      difference() {
        rounded_prism(frame_length - 28, deck_width - 28, deck_thickness, 8);
        for (x = [-270 : 45 : 270])
          for (y = [-112 : 56 : 112])
            translate([x, y, 0]) cylinder(d = 5, h = deck_thickness + 2, center = true);
      }
    if (show_fasteners)
      for (x = [-270 : 45 : 270])
        for (y = [-112 : 56 : 112])
          through_bolt(x, y, 160 + (exploded_view ? 8 : 0), 6, 3);
  }

  for (x = [-frame_length / 2 + 16, frame_length / 2 - 16])
    for (y = [-deck_width / 2 + 12, deck_width / 2 - 12])
      translate([x, y, 126])
        color([0.10, 0.14, 0.17]) cube([32, 34, 46], center = true);

  for (x = [-wheel_center_x, wheel_center_x])
    for (y = [-wheel_center_y, wheel_center_y])
      wheel_assembly(x, y, wheel_axle_z);
}

module guide_roller(x, y) {
  translate([x, y, 90])
    rotate([90, 0, 0])
      color([0.12, 0.17, 0.20]) cylinder(d = 34, h = 26, center = true);
}

module shuttle_car_reference() {
  chassis_assembly();

  if (show_powertrain) {
    for (x = [-wheel_center_x, wheel_center_x])
      for (y = [-deck_width * 0.33, deck_width * 0.33])
        drive_motor(x, y, y > 0 ? 1 : -1);
    for (x = [-220, -75, 75, 220])
      for (y = [-deck_width / 2 - 12, deck_width / 2 + 12])
        guide_roller(x, y);
  }

  if (show_battery) battery_tray_reference();

  if (show_sensors)
    for (x = [-frame_length / 2 + 28, frame_length / 2 - 28])
      for (y = [-deck_width / 2 + 28, deck_width / 2 - 28])
        sensor_pod(x, y);

  translate([0, 0, 183 + (exploded_view ? 30 : 0)]) {
    color([0.77, 0.43, 0.13]) cylinder(d = 28, h = 12, center = true);
    translate([0, 0, 10]) color([0.95, 0.64, 0.22]) sphere(d = 20);
  }
}

shuttle_car_reference();
