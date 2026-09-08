import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
c.executescript(Path('drizzle/0000_secret_klaw.sql').read_text())
c.execute('PRAGMA foreign_keys=ON')
for uid,role in [('owner','contractor'),('one','buyer'),('two','buyer')]:
 c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?)',(uid,role,uid,uid+'@example.test','','Austin',30,-97,20,'[]'))
c.execute('INSERT INTO listings(id,photo,category,material,condition,title,description,address,lat,lng,posted_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',('item','image','Doors','Wood','Good','Door','A door','Private',30,-97,'owner',0))
update="UPDATE listings SET status='claimed',claimed_by=? WHERE id=? AND status='available' AND posted_by<>? RETURNING *"
notice="INSERT INTO notifications(id,user_id,listing_id,message,created_at) SELECT ?,posted_by,id,? || title || ?,? FROM listings WHERE id=? AND claimed_by=? AND changes()=1"
for buyer,expected in [('one',1),('two',0),('one',0)]:
 rows=c.execute(update,(buyer,'item',buyer)).fetchall()
 assert len(rows)==expected
 c.execute(notice,(buyer+str(expected),'claimed ',' contact',0,'item',buyer))
assert c.execute('SELECT COUNT(*) FROM notifications').fetchone()[0]==1
assert c.execute("SELECT COUNT(*) FROM listings WHERE status='available'").fetchone()[0]==0
assert c.execute('SELECT claimed_by FROM listings').fetchone()[0]=='one'
print('PASS: schema, single-winner claims, no duplicate alerts, claimed feed exclusion')
