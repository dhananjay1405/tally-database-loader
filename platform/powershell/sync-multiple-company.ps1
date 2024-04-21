$src = Import-Csv -Path .\config.csv
foreach ($item in $src)
{
    Start-Process -FilePath node.exe -WorkingDirectory .\ -ArgumentList ".\dist\index.js --database-schema $($item.schema) --tally-company ""$($item.company)""" -Wait
    
}