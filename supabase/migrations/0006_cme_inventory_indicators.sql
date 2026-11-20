-- COMEX inventory import: total stocks are derived from the same report, not an independent model input.
update public.data_sources set source_kind='file', source_url='https://www.cmegroup.com/solutions/clearing/operations-and-deliveries/nymex-delivery-notices.html', license_status='unverified', expected_cadence='daily', enabled=false, updated_at=now() where id='cme-comex';
update public.data_sources set license_status='restricted', enabled=false, updated_at=now() where id='lbma';
insert into public.indicators (key,name,group_key,unit,description,direction,freshness_hours,enabled)
values ('comex_total_stocks','COMEX total stocks','inventory_liquidity','oz','Registered plus eligible COMEX silver warehouse stocks; derived from the same daily report and not an independent signal input',-1,48,false)
on conflict (key) do update set name=excluded.name,unit=excluded.unit,description=excluded.description,freshness_hours=excluded.freshness_hours,enabled=false,updated_at=now();

-- Market-data import registrations. The licensed vendor remains disabled until rights and credentials are verified.
insert into public.data_sources (id,name,source_url,source_kind,license_status,expected_cadence,enabled)
values ('licensed-market-data','Licensed market-data provider',null,'file','unverified','daily',false)
on conflict (id) do nothing;

insert into public.indicators (key,name,group_key,unit,description,direction,freshness_hours,enabled)
values ('silver_spot_usd_oz','Silver spot reference','macro','USD/oz','Licensed provider spot reference; displayed separately and excluded from the composite score until independently reviewed',1,48,false)
on conflict (key) do update set name=excluded.name,unit=excluded.unit,description=excluded.description,freshness_hours=excluded.freshness_hours,enabled=false,updated_at=now();
