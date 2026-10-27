# Facility Service Assistant

The **Facility Service Assistant** is an SAP Joule agent designed to help employees report and manage office equipment issues through natural language.

Instead of manually searching for equipment, checking previous incidents, or creating service tickets, employees can simply describe the problem to Joule.

For example:

> "The projector in meeting room B2 won't turn on."

The assistant can identify the equipment, check its service history, determine the appropriate priority and support team, and create a service ticket after confirmation.

---

## Project Goal

The main goal of this project is to learn how **SAP Joule, Joule Skills, SAP Build Actions, SAP BTP, and SAP CAP** work together in an end-to-end business scenario.

The project focuses on integration and agent orchestration rather than complex business logic.

---

## How It Works

The solution follows this flow:

```text
Employee
   ↓
SAP Joule
   ↓
Facility Service Assistant Agent
   ↓
Joule Skills
   ↓
SAP Build Actions
   ↓
SAP BTP Destination
   ↓
SAP CAP Service
```

The Joule agent understands the employee's request and chooses the appropriate skills.

Each skill calls an SAP Build Action, which communicates with the CAP backend through an SAP BTP destination.

The CAP service manages the business data and applies the business rules.

---

## Main Capabilities

The Facility Service Assistant provides five main capabilities:

1. **Find Equipment**  
   Find office equipment using an equipment ID or room.

2. **Get Equipment History**  
   Retrieve the latest service tickets related to a piece of equipment.

3. **Create Service Ticket**  
   Create a new service ticket for broken equipment.

4. **Get Ticket Status**  
   Check the current status of an existing service ticket.

5. **Update Ticket**  
   Add a note or change the priority of an open ticket.

---

## Business Objects

The CAP backend manages three main business objects:

### Equipment

Represents office equipment such as:

- Projectors
- Screens
- Printers
- PCs
- Air conditioning systems
- Coffee machines

### Service Tickets

Contains information about reported equipment problems, including:

- Ticket number
- Equipment
- Problem description
- Reporter
- Priority
- Status
- Assigned support team
- Target date
- Notes

### Service Teams

The available support teams are:

- AV Support
- IT Support
- Facilities

---

## Business Rules

The backend applies several simple business rules.

### Priority

```text
High criticality   → P1 → Same day
Medium criticality → P2 → Within 2 days
Low criticality    → P3 → Within 5 days
```

### Team Assignment

```text
Projector / Screen        → AV Support
Printer / PC              → IT Support
Air Conditioning / Coffee → Facilities
```

### Duplicate Prevention

If an equipment item already has an **Open** or **In Progress** ticket, a new ticket is not created. The existing ticket is returned instead.

### Warranty

If the equipment is still under warranty, the ticket receives the following note:

> Under warranty – contact vendor first.

### Ticket Updates

Only **Open** or **In Progress** tickets can be updated.

Changing the ticket priority automatically recalculates its target date.

---

## Technology Stack

The project uses:

- **SAP Cloud Application Programming Model (CAP)**
- **Node.js**
- **SAP BTP**
- **Cloud Foundry**
- **SAP BTP Destinations**
- **SAP Build Actions**
- **SAP Build Joule Studio**
- **Joule Skills**
- **Joule Agents**

---

## Project Structure

```text
facility-service-assistant/
│
├── db/
│   ├── schema.cds
│   └── data/
│
├── srv/
│   ├── facility-service.cds
│   └── facility-service.js
│
├── test/
│   └── requests.http
│
├── package.json
└── README.md
```

### `db/`

Contains the CAP data model and sample data.

### `srv/`

Contains the service definition and implementation of the business logic.

### `test/`

Contains HTTP requests used to test the CAP operations locally.

---

## Development Roadmap

The project is implemented in several stages:

```text
1. Build the CAP backend
        ↓
2. Deploy the CAP service to Cloud Foundry
        ↓
3. Configure the SAP BTP Destination
        ↓
4. Create and publish SAP Build Actions
        ↓
5. Create and test the Joule Skills
        ↓
6. Create and deploy the Joule Agent
        ↓
7. Run the end-to-end test scenarios
```

---

## Example Scenario

An employee reports:

> "The projector in meeting room B2 won't turn on."

The Facility Service Assistant:

1. Finds the projector in meeting room B2.
2. Retrieves its previous service tickets.
3. Identifies its criticality.
4. Determines the appropriate priority.
5. Selects the responsible support team.
6. Checks whether another active ticket already exists.
7. Summarizes the ticket information.
8. Asks the employee for confirmation.
9. Creates the service ticket.
10. Returns the new ticket information.

---

## Purpose

This project is a practical exercise for understanding how an AI agent can interact with enterprise services and execute real business operations using the SAP ecosystem.

The final objective is to have a complete end-to-end flow where an employee can manage facility-related equipment issues directly through SAP Joule.