-- Rename "context" to "location" throughout: this concept exists to support
-- GPS-based switching between lists, so "location" is the clearer name.

alter table contexts rename to locations;
alter table locations rename constraint contexts_pkey to locations_pkey;
alter table locations rename constraint contexts_user_id_fkey to locations_user_id_fkey;
alter table locations rename constraint contexts_name_check to locations_name_check;
alter table locations rename constraint contexts_radius_m_check to locations_radius_m_check;
alter index contexts_user_id_idx rename to locations_user_id_idx;
alter trigger contexts_set_updated_at on locations rename to locations_set_updated_at;

alter policy "Users can view their own contexts" on locations rename to "Users can view their own locations";
alter policy "Users can insert their own contexts" on locations rename to "Users can insert their own locations";
alter policy "Users can update their own contexts" on locations rename to "Users can update their own locations";
alter policy "Users can delete their own contexts" on locations rename to "Users can delete their own locations";

alter table reminders rename column context_id to location_id;
alter table reminders rename constraint reminders_context_id_fkey to reminders_location_id_fkey;
alter index reminders_context_id_idx rename to reminders_location_id_idx;
