"""Focus-scoped game keys; no desktop/global bindings."""
class Keyboard:
    def __init__(self):
        self.held=set()

    def update(self,game):
        game.set_yoke(int('right' in self.held)-int('left' in self.held),
                      int('down' in self.held)-int('up' in self.held))

    def press(self,key,game):
        if key not in ('left','right','up','down','space','p','r','t','escape'):
            return None
        if key in self.held:
            return 'handled'
        self.held.add(key)
        if key in ('left','right','up','down'):
            self.update(game)
        elif key=='space':
            game.drop()
        else:
            return {'p':'pause','r':'reset','t':'theme','escape':'pause'}[key]
        return 'handled'

    def release(self,key,game):
        self.held.discard(key)
        if key in ('left','right','up','down'):
            self.update(game)

    def clear(self,game):
        self.held.clear()
        game.set_yoke(0,0)
        game.dh=game.dv=0
