"""Verify administrator provisioning without introducing business fixtures."""
import contextlib, json, os, pathlib, sqlite3, subprocess, tempfile

root = pathlib.Path(__file__).resolve().parents[1]
assembly = root / 'src/DynamicConstruction.Api/bin/Release/net10.0/DynamicConstruction.Api.dll'
with tempfile.TemporaryDirectory(prefix='dc-bootstrap-') as temporary:
    database = pathlib.Path(temporary) / 'bootstrap.db'
    env = dict(os.environ, ASPNETCORE_ENVIRONMENT='Development', Database__Provider='Sqlite', Storage__Provider='Local', ConnectionStrings__Database='Data Source=' + str(database), Bootstrap__Email='bootstrap@example.test', Bootstrap__Password=os.environ['TEST_PASSWORD'])
    command = ['dotnet', str(assembly), '--bootstrap-admin']
    first = subprocess.run(command, env=env, cwd=temporary, capture_output=True, timeout=45)
    assert first.returncode == 0, first.stderr.decode(errors='replace')[-500:]
    repeat = subprocess.run(command, env=env, cwd=temporary, capture_output=True, timeout=45)
    assert repeat.returncode != 0
    with contextlib.closing(sqlite3.connect(database)) as db:
        assert db.execute('SELECT count(*) FROM AspNetUsers').fetchone()[0] == 1
        for table in ['Quotes', 'Projects', 'EstimateRates', 'Portfolio']:
            assert db.execute('SELECT count(*) FROM ' + table).fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM Audit WHERE Action='Account.BootstrapAdmin'").fetchone()[0] == 1
    report = {'passed': 3, 'checks': ['First administrator provisioned', 'Repeat bootstrap refused', 'No business data seeded']}
    (root / 'artifacts').mkdir(exist_ok=True)
    (root / 'artifacts/bootstrap.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
