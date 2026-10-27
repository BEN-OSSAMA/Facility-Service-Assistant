const cds = require('@sap/cds');

const { SELECT, INSERT, UPDATE } = cds.ql;

module.exports = cds.service.impl(function () {

    const {
        Equipment,
        ServiceTickets,
        ServiceTeams
    } = cds.entities('facility.service');


    /*
     * ============================================================
     * HELPERS
     * ============================================================
     */

    const ACTIVE_STATUSES = ['Open', 'InProgress'];

    const PRIORITIES = {
        P1: 0,
        P2: 2,
        P3: 5
    };


    /**
     * Return today's date as YYYY-MM-DD.
     */
    function today() {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);

        return date.toISOString().slice(0, 10);
    }


    /**
     * Add days to today and return YYYY-MM-DD.
     */
    function addDays(days) {
        const date = new Date();

        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() + days);

        return date.toISOString().slice(0, 10);
    }


    /**
     * Determine priority from equipment criticality.
     *
     * High   -> P1
     * Medium -> P2
     * Low    -> P3
     */
    function getPriorityFromCriticality(criticality) {

        switch (criticality) {

            case 'High':
                return 'P1';

            case 'Medium':
                return 'P2';

            case 'Low':
                return 'P3';

            default:
                return null;
        }
    }


    /**
     * Calculate target date from priority.
     *
     * P1 -> today
     * P2 -> +2 days
     * P3 -> +5 days
     */
    function getTargetDate(priority) {

        const days = PRIORITIES[priority];

        if (days === undefined) {
            return null;
        }

        return addDays(days);
    }


    /**
     * Determine support team from equipment type.
     */
    function getTeamFromEquipmentType(type) {

        if (!type) {
            return null;
        }

        const normalizedType = type.trim().toLowerCase();

        if (
            normalizedType === 'projector' ||
            normalizedType === 'screen'
        ) {
            return {
                ID: 'TEAM-AV',
                name: 'AV Support'
            };
        }

        if (
            normalizedType === 'printer' ||
            normalizedType === 'pc'
        ) {
            return {
                ID: 'TEAM-IT',
                name: 'IT Support'
            };
        }

        if (
            normalizedType === 'air conditioning' ||
            normalizedType === 'coffee machine'
        ) {
            return {
                ID: 'TEAM-FAC',
                name: 'Facilities'
            };
        }

        return null;
    }


    /**
     * Get the latest note from a notes field.
     */
    function getLastNote(notes) {

        if (!notes) {
            return null;
        }

        const allNotes = notes
            .split('\n')
            .map(note => note.trim())
            .filter(Boolean);

        return allNotes.length
            ? allNotes[allNotes.length - 1]
            : null;
    }


    /**
     * Generate the next ticket number.
     *
     * Example:
     * TK-5001
     * TK-5002
     * TK-5003
     *
     * Next:
     * TK-5004
     */
    async function generateTicketNumber(tx) {

        const tickets = await tx.run(
            SELECT.from(ServiceTickets)
                .columns('ticketNumber')
        );

        const numbers = tickets
            .map(ticket => {

                const match =
                    /^TK-(\d+)$/.exec(ticket.ticketNumber);

                return match
                    ? Number(match[1])
                    : null;
            })
            .filter(number => number !== null);


        const highestNumber =
            numbers.length > 0
                ? Math.max(...numbers)
                : 5000;


        return `TK-${highestNumber + 1}`;
    }


    /**
     * Retrieve service team name from its ID.
     */
    async function getTeamName(tx, teamId) {

        if (!teamId) {
            return null;
        }

        const team = await tx.run(
            SELECT.one
                .from(ServiceTeams)
                .columns('name')
                .where({
                    ID: teamId
                })
        );

        return team?.name || null;
    }


    /*
     * ============================================================
     * 1. FIND EQUIPMENT
     * ============================================================
     */

    this.on('findEquipment', async req => {

        const {
            equipmentId,
            room
        } = req.data;


        if (!equipmentId && !room) {

            return req.reject(
                400,
                'Provide either an equipment ID or a room.'
            );
        }


        const tx = cds.tx(req);


        let query = SELECT
            .from(Equipment)
            .columns(
                'ID',
                'name',
                'type',
                'room',
                'criticality',
                'warrantyEndDate'
            );


        /*
         * Equipment ID has priority when both values
         * are provided.
         */
        if (equipmentId) {

            query = query.where({
                ID: equipmentId
            });

        } else {

            query = query.where({
                room: room
            });
        }


        const equipment = await tx.run(query);


        return equipment;
    });


    /*
     * ============================================================
     * 2. GET EQUIPMENT HISTORY
     * ============================================================
     */

    this.on('getEquipmentHistory', async req => {

        const {
            equipmentId
        } = req.data;


        if (!equipmentId) {

            return req.reject(
                400,
                'Equipment ID is required.'
            );
        }


        const tx = cds.tx(req);


        /*
         * Verify that the equipment exists.
         */
        const equipment = await tx.run(

            SELECT.one
                .from(Equipment)
                .where({
                    ID: equipmentId
                })
        );


        if (!equipment) {

            return req.reject(
                404,
                `Equipment ${equipmentId} was not found.`
            );
        }


        /*
         * Return maximum 5 latest tickets.
         *
         * Ticket number is used as ordering because
         * the provided initial sample tickets do not
         * contain explicit historical dates.
         */
        const tickets = await tx.run(

            SELECT.from(ServiceTickets)
                .columns(
                    'ticketNumber',
                    'problemDescription',
                    'status',
                    'createdAt'
                )
                .where({
                    equipment_ID: equipmentId
                })
                .orderBy('ticketNumber desc')
                .limit(5)
        );


        return tickets.map(ticket => ({

            ticketNumber:
                ticket.ticketNumber,

            date:
                ticket.createdAt || null,

            problemDescription:
                ticket.problemDescription,

            status:
                ticket.status
        }));
    });


    /*
     * ============================================================
     * 3. CREATE SERVICE TICKET
     * ============================================================
     */

    this.on('createServiceTicket', async req => {

        const {
            equipmentId,
            problemDescription,
            reportedBy
        } = req.data;


        /*
         * Validate required inputs.
         */
        if (!equipmentId) {

            return req.reject(
                400,
                'Equipment ID is required.'
            );
        }


        if (!problemDescription) {

            return req.reject(
                400,
                'Problem description is required.'
            );
        }


        if (!reportedBy) {

            return req.reject(
                400,
                'Reported by is required.'
            );
        }


        const tx = cds.tx(req);


        /*
         * --------------------------------------------------------
         * Find equipment
         * --------------------------------------------------------
         */

        const equipment = await tx.run(

            SELECT.one
                .from(Equipment)
                .where({
                    ID: equipmentId
                })
        );


        if (!equipment) {

            return req.reject(
                404,
                `Equipment ${equipmentId} was not found.`
            );
        }


        /*
         * --------------------------------------------------------
         * RULE 3:
         * Prevent duplicate active tickets.
         *
         * Open / InProgress -> return existing ticket.
         * --------------------------------------------------------
         */

        const existingTickets = await tx.run(

            SELECT.from(ServiceTickets)
                .where({
                    equipment_ID: equipmentId
                })
        );


        const existingActiveTicket =
            existingTickets.find(ticket =>
                ACTIVE_STATUSES.includes(ticket.status)
            );


        if (existingActiveTicket) {

            const teamName = await getTeamName(
                tx,
                existingActiveTicket.assignedTeam_ID
            );


            return {

                ticketNumber:
                    existingActiveTicket.ticketNumber,

                priority:
                    existingActiveTicket.priority,

                assignedTeam:
                    teamName,

                targetDate:
                    existingActiveTicket.targetDate,

                status:
                    existingActiveTicket.status,

                note:
                    getLastNote(existingActiveTicket.notes),

                created:
                    false
            };
        }


        /*
         * --------------------------------------------------------
         * RULE 1:
         * Priority from equipment criticality.
         * --------------------------------------------------------
         */

        const priority =
            getPriorityFromCriticality(
                equipment.criticality
            );


        if (!priority) {

            return req.reject(
                400,
                `No priority rule exists for criticality ${equipment.criticality}.`
            );
        }


        /*
         * Calculate target date.
         */
        const targetDate =
            getTargetDate(priority);


        /*
         * --------------------------------------------------------
         * RULE 2:
         * Team from equipment type.
         * --------------------------------------------------------
         */

        const team =
            getTeamFromEquipmentType(
                equipment.type
            );


        if (!team) {

            return req.reject(
                400,
                `No service team is configured for equipment type ${equipment.type}.`
            );
        }


        /*
         * --------------------------------------------------------
         * RULE 4:
         * Warranty check.
         * --------------------------------------------------------
         */

        let warrantyNote = null;


        if (
            equipment.warrantyEndDate &&
            equipment.warrantyEndDate >= today()
        ) {

            warrantyNote =
                'Under warranty - contact vendor first';
        }


        /*
         * --------------------------------------------------------
         * Generate ticket number.
         * --------------------------------------------------------
         */

        const ticketNumber =
            await generateTicketNumber(tx);


        /*
         * --------------------------------------------------------
         * Create ticket.
         * --------------------------------------------------------
         */

        const newTicket = {

            ticketNumber:

                ticketNumber,

            equipment_ID:

                equipment.ID,

            problemDescription:

                problemDescription.trim(),

            reportedBy:

                reportedBy.trim(),

            priority:

                priority,

            status:

                'Open',

            assignedTeam_ID:

                team.ID,

            targetDate:

                targetDate,

            notes:

                warrantyNote
        };


        await tx.run(

            INSERT.into(ServiceTickets)
                .entries(newTicket)
        );


        /*
         * Return the information needed by Joule.
         */
        return {

            ticketNumber:
                ticketNumber,

            priority:
                priority,

            assignedTeam:
                team.name,

            targetDate:
                targetDate,

            status:
                'Open',

            note:
                warrantyNote,

            created:
                true
        };
    });


    /*
     * ============================================================
     * 4. GET TICKET STATUS
     * ============================================================
     */

    this.on('getTicketStatus', async req => {

        const {
            ticketNumber
        } = req.data;


        if (!ticketNumber) {

            return req.reject(
                400,
                'Ticket number is required.'
            );
        }


        const tx = cds.tx(req);


        const ticket = await tx.run(

            SELECT.one
                .from(ServiceTickets)
                .where({
                    ticketNumber: ticketNumber
                })
        );


        if (!ticket) {

            return req.reject(
                404,
                `Ticket ${ticketNumber} was not found.`
            );
        }


        const teamName =
            await getTeamName(
                tx,
                ticket.assignedTeam_ID
            );


        return {

            ticketNumber:
                ticket.ticketNumber,

            status:
                ticket.status,

            assignedTeam:
                teamName,

            targetDate:
                ticket.targetDate,

            lastNote:
                getLastNote(ticket.notes)
        };
    });


    /*
     * ============================================================
     * 5. UPDATE TICKET
     * ============================================================
     */

    this.on('updateTicket', async req => {

        const {
            ticketNumber,
            note,
            newPriority
        } = req.data;


        if (!ticketNumber) {

            return req.reject(
                400,
                'Ticket number is required.'
            );
        }


        if (!note && !newPriority) {

            return req.reject(
                400,
                'Provide a note and/or a new priority.'
            );
        }


        const tx = cds.tx(req);


        /*
         * Find ticket.
         */
        const ticket = await tx.run(

            SELECT.one
                .from(ServiceTickets)
                .where({
                    ticketNumber: ticketNumber
                })
        );


        if (!ticket) {

            return req.reject(
                404,
                `Ticket ${ticketNumber} was not found.`
            );
        }


        /*
         * --------------------------------------------------------
         * RULE 5:
         * Only Open or InProgress tickets can be updated.
         * --------------------------------------------------------
         */

        if (!ACTIVE_STATUSES.includes(ticket.status)) {

            return req.reject(
                409,
                `Ticket ${ticketNumber} cannot be updated because its status is ${ticket.status}.`
            );
        }


        const changes = {};


        /*
         * Add note without deleting previous notes.
         */
        if (note) {

            const cleanNote =
                note.trim();


            changes.notes =
                ticket.notes
                    ? `${ticket.notes}\n${cleanNote}`
                    : cleanNote;
        }


        /*
         * Change priority.
         */
        if (newPriority) {

            const cleanPriority =
                newPriority.trim().toUpperCase();


            if (!PRIORITIES.hasOwnProperty(cleanPriority)) {

                return req.reject(
                    400,
                    'Priority must be P1, P2 or P3.'
                );
            }


            changes.priority =
                cleanPriority;


            /*
             * RULE 5:
             * Changing priority recalculates target date.
             */
            changes.targetDate =
                getTargetDate(cleanPriority);
        }


        /*
         * Update database.
         */
        await tx.run(

            UPDATE(ServiceTickets)
                .set(changes)
                .where({
                    ticketNumber: ticketNumber
                })
        );


        /*
         * Return updated ticket information.
         */
        return {

            ticketNumber:
                ticketNumber,

            status:
                ticket.status,

            priority:
                changes.priority || ticket.priority,

            targetDate:
                changes.targetDate || ticket.targetDate,

            lastNote:
                note
                    ? note.trim()
                    : getLastNote(ticket.notes)
        };
    });

});