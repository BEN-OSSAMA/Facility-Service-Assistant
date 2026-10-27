namespace facility.service;

using {
    cuid,
    managed
} from '@sap/cds/common';


/**
 * Support teams responsible for handling equipment issues.
 */
entity ServiceTeams : cuid, managed {
    name        : String(100) not null;
    description : String(255);
}


/**
 * Office equipment managed by the Facility Service Assistant.
 */
entity Equipment : managed {

    key ID          : String(20);

    name            : String(100) not null;

    type            : String(50) not null;

    room            : String(100) not null;

    criticality     : String(10) enum {
        High;
        Medium;
        Low;
    };

    warrantyEndDate : Date;
}


/**
 * Service tickets created for equipment issues.
 */
entity ServiceTickets : managed {

    key ticketNumber : String(20);

    equipment        : Association to Equipment not null;

    problemDescription : String(500) not null;

    reportedBy       : String(100) not null;

    priority         : String(2) enum {
        P1;
        P2;
        P3;
    };

    status           : String(20) enum {
        Open;
        InProgress;
        Resolved;
        Closed;
    };

    assignedTeam     : Association to ServiceTeams;

    targetDate       : Date;

    notes            : LargeString;
}