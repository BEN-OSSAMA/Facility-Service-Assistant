using { facility.service as db } from '../db/schema';

@path: '/facility'
service FacilityService {

    /*
     * ============================================================
     * OUTPUT TYPES
     * ============================================================
     */

    type EquipmentResult {
        ID              : String(20);
        name            : String(100);
        type            : String(50);
        room            : String(100);
        criticality     : String(10);
        warrantyEndDate : Date;
    }


    type TicketHistoryItem {
        ticketNumber       : String(20);
        date               : Timestamp;
        problemDescription : String(500);
        status             : String(20);
    }


    type CreateTicketResult {
        ticketNumber : String(20);
        priority     : String(2);
        assignedTeam : String(100);
        targetDate   : Date;
        status       : String(20);
        note         : LargeString;
        created      : Boolean;
    }


    type TicketStatusResult {
        ticketNumber : String(20);
        status       : String(20);
        assignedTeam : String(100);
        targetDate   : Date;
        lastNote     : LargeString;
    }


    type UpdateTicketResult {
        ticketNumber : String(20);
        status       : String(20);
        priority     : String(2);
        targetDate   : Date;
        lastNote     : LargeString;
    }


    /*
     * ============================================================
     * 1. FIND EQUIPMENT
     * ============================================================
     *
     * Search equipment using either:
     * - equipment ID
     * - room
     */

    function findEquipment(
        equipmentId : String(20),
        room        : String(100)
    ) returns many EquipmentResult;


    /*
     * ============================================================
     * 2. GET EQUIPMENT HISTORY
     * ============================================================
     *
     * Return the latest service tickets for an equipment.
     * Maximum 5 tickets will be handled by the service logic.
     */

    function getEquipmentHistory(
        equipmentId : String(20)
    ) returns many TicketHistoryItem;


    /*
     * ============================================================
     * 3. CREATE SERVICE TICKET
     * ============================================================
     *
     * Creates a ticket for an equipment issue.
     *
     * Business rules such as priority, team assignment,
     * duplicate detection and warranty check will be
     * implemented in facility-service.js.
     */

    action createServiceTicket(
        equipmentId       : String(20),
        problemDescription : String(500),
        reportedBy        : String(100)
    ) returns CreateTicketResult;


    /*
     * ============================================================
     * 4. GET TICKET STATUS
     * ============================================================
     */

    function getTicketStatus(
        ticketNumber : String(20)
    ) returns TicketStatusResult;


    /*
     * ============================================================
     * 5. UPDATE TICKET
     * ============================================================
     *
     * Allows:
     * - adding a note
     * - changing ticket priority
     */

    action updateTicket(
        ticketNumber : String(20),
        note         : String(1000),
        newPriority  : String(2)
    ) returns UpdateTicketResult;
}