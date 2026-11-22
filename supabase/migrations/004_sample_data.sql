-- Sample data for Zordaq Motorsports JB.
-- User-owned records are intentionally omitted until real Auth users exist.

insert into public.vehicles (plate_no, car_model)
values
  ('JRX 1234', 'Honda Civic FD'),
  ('JQK 7788', 'Toyota GR Yaris'),
  ('VDA 9090', 'Perodua Myvi 1.5')
on conflict (plate_no) do update
set car_model = excluded.car_model;
