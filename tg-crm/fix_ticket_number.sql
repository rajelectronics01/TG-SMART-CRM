-- Run this in your Supabase SQL Editor to stop the database from overriding your new Ticket Numbers!

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-generate if the frontend didn't already send a custom one!
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'TG' || TO_CHAR(NEXTVAL('ticket_seq'), 'FM000');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
