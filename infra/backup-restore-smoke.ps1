$ErrorActionPreference = 'Stop'
$container = 'tuitionflow-postgres'
$sourceDatabase = 'tuitionflow'
$restoreDatabase = 'tuitionflow_restore_smoke'
$dumpPath = '/tmp/tuitionflow-restore-smoke.dump'

$running = docker inspect -f '{{.State.Running}}' $container
if ($running -ne 'true') { throw "Container $container is not running" }

docker exec $container pg_dump -U tuitionflow -d $sourceDatabase -Fc -f $dumpPath
docker exec $container psql -U tuitionflow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $restoreDatabase WITH (FORCE);"
docker exec $container psql -U tuitionflow -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $restoreDatabase OWNER tuitionflow;"
try {
  docker exec $container pg_restore -U tuitionflow -d $restoreDatabase --exit-on-error $dumpPath
  docker exec $container psql -U tuitionflow -d $restoreDatabase -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS migration_count FROM _prisma_migrations;'
} finally {
  docker exec $container psql -U tuitionflow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $restoreDatabase WITH (FORCE);"
}
