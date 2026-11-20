-- Add FRED-backed macro series without mislabelling the broad trade-weighted USD index as DXY.
insert into public.indicators (key,name,group_key,unit,description,direction,freshness_hours) values
('us_10y_nominal_yield','US 10Y nominal yield','macro','percent','10-year US Treasury constant-maturity nominal yield',-1,72)
on conflict (key) do nothing;

update public.indicators
set name='Broad trade-weighted USD index',
    description='Federal Reserve broad trade-weighted US dollar index; not the ICE DXY index'
where key='us_dollar_index';
