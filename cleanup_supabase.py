# ==========================================================
# EPICONSULT e-CLINIC — Supabase Table Cleanup Script
# Drops all tables except 'users' and 'activities'
# ==========================================================
import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.pool import NullPool

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("DATABASE_URL not found in environment variables")
    raise ValueError("DATABASE_URL must be set in .env file")

# Tables to keep
KEEP_TABLES = {'users', 'activities', 'alembic_version'}

try:
    engine = create_engine(DATABASE_URL, poolclass=NullPool, echo=False)
    
    with engine.connect() as conn:
        # Get all tables
        inspector = inspect(engine)
        all_tables = inspector.get_table_names()
        
        logger.info(f"Found {len(all_tables)} tables in database")
        logger.info(f"Tables: {', '.join(all_tables)}")
        
        # Get tables to drop
        tables_to_drop = [t for t in all_tables if t not in KEEP_TABLES]
        
        if not tables_to_drop:
            logger.info("No tables to drop. All tables are in the keep list.")
        else:
            logger.warning(f"About to drop {len(tables_to_drop)} tables: {', '.join(tables_to_drop)}")
            
            # Confirm before dropping
            response = input("Do you want to proceed? (yes/no): ")
            if response.lower() != 'yes':
                logger.info("Cleanup cancelled.")
                exit(0)
            
            # Drop tables
            for table in tables_to_drop:
                try:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    conn.commit()
                    logger.info(f"Dropped table: {table}")
                except Exception as e:
                    logger.error(f"Error dropping table {table}: {str(e)}")
                    conn.rollback()
            
            logger.info("Cleanup completed successfully!")
    
    # List remaining tables
    with engine.connect() as conn:
        inspector = inspect(engine)
        remaining_tables = inspector.get_table_names()
        logger.info(f"Remaining tables: {', '.join(remaining_tables)}")
        
except Exception as e:
    logger.error(f"Error during cleanup: {str(e)}")
    raise

