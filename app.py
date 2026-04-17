"""
Flask应用主入口
"""
from flask import Flask, render_template
from flask_migrate import Migrate
from dotenv import load_dotenv

load_dotenv()

from config import get_config
from models import db
from routes import register_blueprints
from logger import setup_logging

config = get_config()

app = Flask(__name__)
app.config.from_object(config)

db.init_app(app)
migrate = Migrate(app, db)

setup_logging(app)

register_blueprints(app)


@app.route('/')
def index():
    """首页"""
    return render_template('index.html')


@app.route('/api/db/migrate', methods=['POST'])
def db_migrate():
    """执行数据库迁移（添加新列）- 使用安全迁移模块"""
    from migrations import run_migrations
    from flask import jsonify
    
    try:
        results = run_migrations(app)
        return jsonify({
            'success': True,
            'results': results,
            'message': '数据库迁移完成'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        from migrations import run_migrations
        run_migrations(app)
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )
