/* groups: PARENT --> CHILD traversal */
with recursive cte as (
    select name, parent from mst_group where name = 'Loans & Advances (Asset)'
    union all
    select e.name, e.parent from mst_group e inner join cte on cte.name = e.parent
)
select * from cte;