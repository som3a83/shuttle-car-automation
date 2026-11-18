# Terms of Use — Shuttle Car Automation

**Effective date:** 17 November 2026

## 1. Purpose
Shuttle Car Automation is an operational recordkeeping and engineering-visualization application for shuttle-car fleets, batteries, faults, maintenance, shift handovers and reports.

## 2. No machine control
The current release is a local recordkeeping application. It does not directly connect to, command, stop, start, move, charge, or otherwise control any physical shuttle, PLC, battery management system, conveyor or warehouse automation equipment. An optional HTTPS client can read from a separately deployed and authorized OT gateway only after the plant commissions the approved read-only tags. No gateway is configured by default. Status values and readings remain manually entered, sample, simulated, unknown or unverified unless a separately validated source is explicitly identified.

## 3. Not a safety system
The application is not a safety instrumented system, emergency stop, machine protection device, condition-monitoring certification, maintenance authorization, or substitute for manufacturer documentation and qualified technical judgment. Never use it as the sole basis for a safety, maintenance, production or release-to-service decision.

## 4. Engineering illustrations
Three-dimensional shuttle and battery views are conceptual illustrations. They are not manufacturer CAD, approved technical drawings, dimensional models, wiring diagrams or service instructions.

## 5. Records and backups
The current version stores records locally on the current device. The user is responsible for device access control, backups, exports, accuracy of entered information and secure handling of exported files. The application provides local account sign-in, a role-permission matrix, session handling and application-level mutation checks. These controls operate on the current device and are not server-enforced authorization or a security boundary against someone who can modify local application storage or code. There is no shared identity service or multi-device account management.

## 6. No vendor endorsement
Manufacturer names and references identify equipment categories or public reference material only. The application is not endorsed by, affiliated with or certified by Cassioli, Craftsman, ACME or any other equipment manufacturer.

## 7. Availability
The application is supplied as an operational software tool without a guarantee that it is suitable for a particular industrial environment. Validate it on the intended devices and workflows before relying on it for business operations.

## 8. Contact
For support and terms questions, use the project contact page:  
https://github.com/som3a83/shuttle-car-automation/issues
