/*
  LITHIUM BATTERY PACK — PARAMETRIC ENGINEERING REFERENCE ASSEMBLY
  Units: millimetres (OpenSCAD native units).
  IMPORTANT: Cell layout, enclosure, terminals, electrical components and default dimensions
  are illustrative design-study parameters, NOT an OEM battery drawing or certified pack design.
  Do not fabricate, charge, service, or connect a battery from this reference model.
*/
$fn = 48;

// Editable reference parameters in mm. None are manufacturer-verified.
pack_length = 680;
pack_width = 370;
pack_height = 118;
wall = 4;
cell_columns = 6;
cell_rows = 2;
exploded_view = false;
show_cover = true;
show_bms = true;
show_service_hardware = true;

cell_length = (pack_length - 2 * wall - 34) / cell_columns;
cell_width = (pack_width - 2 * wall - 32) / cell_rows;
cell_height = pack_height * 0.62;

module rounded_block(length, width, height, radius = 5) {
  hull() {
    for (x = [-length / 2 + radius, length / 2 - radius])
      for (y = [-width / 2 + radius, width / 2 - radius])
        translate([x, y, 0]) cylinder(h = height, r = radius, center = true);
  }
}

module enclosure() {
  color([0.20, 0.29, 0.34])
    translate([0, 0, wall / 2])
      rounded_block(pack_length, pack_width, wall, 7);

  color([0.28, 0.38, 0.43]) {
    translate([0, -pack_width / 2 + wall / 2, pack_height / 2])
      cube([pack_length, wall, pack_height], center = true);
    translate([0, pack_width / 2 - wall / 2, pack_height / 2])
      cube([pack_length, wall, pack_height], center = true);
    translate([-pack_length / 2 + wall / 2, 0, pack_height / 2])
      cube([wall, pack_width - 2 * wall, pack_height], center = true);
    translate([pack_length / 2 - wall / 2, 0, pack_height / 2])
      cube([wall, pack_width - 2 * wall, pack_height], center = true);
  }

  color([0.12, 0.18, 0.22])
    translate([0, 0, wall + 2])
      rounded_block(pack_length - 18, pack_width - 18, 5, 4);
}

module prismatic_cell(x, y) {
  translate([x, y, wall + cell_height / 2 + 8]) {
    color([0.30, 0.55, 0.46]) rounded_block(cell_length, cell_width, cell_height, 4);
    color([0.73, 0.47, 0.22])
      translate([0, 0, cell_height / 2 + 3])
        cube([cell_length * 0.56, 12, 5], center = true);
    color([0.74, 0.80, 0.83])
      for (terminal_x = [-cell_length * 0.22, cell_length * 0.22])
        translate([terminal_x, 0, cell_height / 2 + 7])
          cylinder(d = 8, h = 7, center = true);
  }
}

module busbar(y) {
  color([0.78, 0.47, 0.20])
    translate([0, y, pack_height * 0.80 + (exploded_view ? 28 : 0)])
      cube([pack_length - 46, 9, 5], center = true);
}

module bms_assembly() {
  if (show_bms) {
    translate([pack_length / 2 - 36, 0, pack_height * 0.83 + (exploded_view ? 46 : 0)]) {
      color([0.10, 0.31, 0.27]) rounded_block(54, 58, 7, 3);
      color([0.21, 0.42, 0.36])
        translate([0, 0, 7]) cube([28, 25, 8], center = true);
      for (i = [-2 : 1 : 2])
        color([0.72, 0.77, 0.79])
          translate([i * 8, -20, 8]) cylinder(d = 4, h = 4, center = true);
      if (show_service_hardware)
        color([0.80, 0.54, 0.19])
          translate([0, 35, 7]) cube([24, 12, 8], center = true);
    }
  }
}

module terminal_block(x, polarity = 1) {
  translate([x, pack_width / 2 - 22, pack_height * 0.84]) {
    color(polarity > 0 ? [0.76, 0.24, 0.22] : [0.20, 0.38, 0.72])
      cylinder(d = 22, h = 12, center = true);
    color([0.12, 0.16, 0.19])
      translate([0, 0, 9]) cylinder(d = 28, h = 6, center = true);
    if (show_service_hardware)
      color([0.76, 0.80, 0.83])
        translate([0, 0, 15]) cylinder(d = 8, h = 8, center = true);
  }
}

module service_connector() {
  if (show_service_hardware) {
    translate([-pack_length / 2 + 25, pack_width / 2 - 24, pack_height * 0.56]) {
      color([0.12, 0.16, 0.19]) rounded_block(34, 28, 27, 3);
      color([0.70, 0.48, 0.20])
        translate([0, 0, 15]) cube([20, 13, 5], center = true);
    }
  }
}

module lifting_handles() {
  for (x = [-pack_length / 2 + 38, pack_length / 2 - 38])
    translate([x, -pack_width / 2 + 20, pack_height + (exploded_view ? 34 : 0)]) {
      color([0.60, 0.68, 0.72])
        rotate([90, 0, 0])
          difference() {
            cylinder(d = 24, h = 9, center = true);
            cylinder(d = 14, h = 11, center = true);
          }
    }
}

module cover_assembly() {
  if (show_cover) {
    translate([0, 0, pack_height + 12 + (exploded_view ? 36 : 0)]) {
      color([0.36, 0.46, 0.51, 0.88]) rounded_block(pack_length - 8, pack_width - 8, 10, 6);
      if (show_service_hardware)
        for (x = [-pack_length / 2 + 18, pack_length / 2 - 18])
          for (y = [-pack_width / 2 + 18, pack_width / 2 - 18])
            translate([x, y, 6])
              color([0.78, 0.82, 0.85]) cylinder(d = 7, h = 4, center = true);
    }
  }
}

module battery_pack_reference() {
  enclosure();

  for (row = [0 : cell_rows - 1])
    for (col = [0 : cell_columns - 1]) {
      x = (col - (cell_columns - 1) / 2) * (cell_length + 3);
      y = (row - (cell_rows - 1) / 2) * (cell_width + 4);
      prismatic_cell(x, y);
    }

  busbar(-cell_width / 2 - 6);
  busbar(cell_width / 2 + 6);
  bms_assembly();
  terminal_block(-pack_length / 2 + 42, 1);
  terminal_block(-pack_length / 2 + 78, -1);
  service_connector();
  lifting_handles();
  cover_assembly();
}

battery_pack_reference();
