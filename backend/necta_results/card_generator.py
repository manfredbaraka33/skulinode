
"""
necta_results/card_generator.py
Generates shareable PNG cards — school profiles, regional pride, hidden
gems, gender story, subject leaderboards, and school comparisons.
Visual language matches the web brand: navy/gold/paper palette.
"""
import io
import os
from PIL import Image, ImageDraw, ImageFont,ImageOps

NAVY       = (30, 58, 95)
NAVY_DEEP  = (20, 42, 68)
GOLD       = (196, 160, 20)
GOLD_SOFT  = (232, 214, 138)
BLUE_MID   = (37, 99, 235)
PAPER      = (250, 248, 243)
INK        = (22, 35, 58)
SLATE      = (100, 116, 139)
WHITE      = (255, 255, 255)
GREEN      = (22, 163, 74)
PINK       = (219, 39, 119)
LINE       = (226, 232, 240)

DIVISION_COLORS = {
    'I': (22, 163, 74), 'II': (13, 148, 136), 'III': (202, 138, 4),
    'IV': (234, 88, 12), '0': (185, 28, 28),
}

FONT_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
LOGO_PATH = os.path.join(os.path.dirname(__file__), 'logo.jpg')


def _font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except Exception:
        return ImageFont.load_default()


def F_DISPLAY(size): return _font('Fraunces-Bold.ttf', size)
def F_BOLD(size):    return _font('PlusJakartaSans-Bold.ttf', size)
def F_MED(size):     return _font('PlusJakartaSans-Medium.ttf', size)
def F_BODY(size):    return _font('PlusJakartaSans-Regular.ttf', size)
def F_MONO(size):    return _font('IBMPlexMono-Medium.ttf', size)


def _text_w(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _fit_school_name(draw, name, max_w, font):
    # Shorten long repeated institutional phrases first
    shortened = (
        name.replace("SECONDARY SCHOOL", "SEC. SCHOOL")
            .replace("HIGH SCHOOL", "HIGH")
            .replace("PRIMARY SCHOOL", "PRI. SCHOOL")
    )
    
    # Return immediately if it already fits the allocated pixel width
    if _text_w(draw, shortened, font) <= max_w:
        return shortened
    
    # Otherwise trim and append an ellipsis cleanly
    for i in range(len(shortened), 0, -1):
        candidate = shortened[:i].strip() + "..."
        if _text_w(draw, candidate, font) <= max_w:
            return candidate
            
    return shortened

def _centered(draw, cx, y, text, font, fill):
    w = _text_w(draw, text, font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


def _header(draw, W, label, sublabel=None, img_obj=None):
    draw.rectangle([0, 0, W, 130], fill=NAVY)
    draw.rectangle([0, 126, W, 130], fill=GOLD)
    
    logo_drawn = False
    if os.path.exists(LOGO_PATH):
        try:
            with Image.open(LOGO_PATH) as logo:
                logo = logo.convert('RGBA')
                # Fit inside 54x54 box proportionally without cropping top/bottom
                logo.thumbnail((54, 54), Image.Resampling.LANCZOS)
                
                if img_obj:
                    # Center the logo inside the 54x54 space at (36, 36)
                    lw, lh = logo.size
                    offset_x = 36 + (54 - lw) // 2
                    offset_y = 36 + (54 - lh) // 2
                    img_obj.paste(logo, (offset_x, offset_y), mask=logo)
                    logo_drawn = True
        except Exception:
            pass

    if not logo_drawn:
        # Fallback if image loading fails
        draw.ellipse([36, 36, 90, 90], fill=WHITE)
        draw.text((50, 48), 'S', font=F_DISPLAY(34), fill=NAVY)

    draw.text((106, 42), 'SkuliNode', font=F_BOLD(30), fill=WHITE)
    draw.text((106, 78), label, font=F_MED(18), fill=GOLD_SOFT)
    if sublabel:
        w = _text_w(draw, sublabel, F_MED(18))
        draw.text((W - 40 - w, 78), sublabel, font=F_MED(18), fill=GOLD_SOFT)


def _footer(draw, W, H, url_text):
    draw.rectangle([0, H - 90, W, H], fill=NAVY_DEEP)
    draw.text((40, H - 62), url_text, font=F_MED(22), fill=WHITE)


def _division_bar(draw, x, y, w, h, divisions, graded_total):
    if not graded_total:
        draw.rounded_rectangle([x, y, x + w, y + h], radius=h / 2, fill=LINE)
        return
    cur_x = x
    for key in ['I', 'II', 'III', 'IV', '0']:
        count = divisions.get(key, 0)
        seg_w = (count / graded_total) * w
        if seg_w > 0:
            draw.rectangle([cur_x, y, cur_x + seg_w, y + h], fill=DIVISION_COLORS[key])
            cur_x += seg_w


def _gender_bars(draw, x, y, w, male_rate, female_rate):
    # Changed w - 140 to w - 240 to leave ~100px for the percentage text on the right
    bar_h, max_w = 34, w - 240 

    draw.text((x, y), 'Wavulana', font=F_MED(20), fill=SLATE)
    bw = (male_rate / 100) * max_w if male_rate else 0
    draw.rounded_rectangle([x + 140, y - 2, x + 140 + max_w, y + bar_h - 2], radius=8, fill=LINE)
    if bw > 0:
        draw.rounded_rectangle([x + 140, y - 2, x + 140 + bw, y + bar_h - 2], radius=8, fill=BLUE_MID)
    draw.text((x + 140 + max_w + 16, y), f'{male_rate}%', font=F_BOLD(20), fill=BLUE_MID)

    y2 = y + bar_h + 14
    draw.text((x, y2), 'Wasichana', font=F_MED(20), fill=SLATE)
    fw = (female_rate / 100) * max_w if female_rate else 0
    draw.rounded_rectangle([x + 140, y2 - 2, x + 140 + max_w, y2 + bar_h - 2], radius=8, fill=LINE)
    if fw > 0:
        draw.rounded_rectangle([x + 140, y2 - 2, x + 140 + fw, y2 + bar_h - 2], radius=8, fill=PINK)
    draw.text((x + 140 + max_w + 16, y2), f'{female_rate}%', font=F_BOLD(20), fill=PINK)



def _png(img):
    buf = io.BytesIO()
    img.save(buf, format='PNG', quality=95)
    buf.seek(0)
    return buf


# ── Card generators ────────────────────────────────────────────────────────

def generate_school_card(center, session):
    W, H = 1080, 1400
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{session.exam_level} {session.year}', 'Matokeo Rasmi', img)

    y = 170
    draw.text((60, y), center.center_name, font=F_DISPLAY(40), fill=NAVY)
    y += 60
    loc = center.region + (f' · {center.district}' if center.district else '')
    draw.text((60, y), loc, font=F_MED(24), fill=SLATE)
    y += 60

    badges = []
    if center.national_rank: badges.append(('Taifa', center.national_rank))
    if center.regional_rank: badges.append(('Mkoa', center.regional_rank))
    if center.district_rank: badges.append(('Wilaya', center.district_rank))

    bx = 60
    for label, val in badges:
        card_w = 280
        draw.rounded_rectangle([bx, y, bx + card_w, y + 100], radius=16, fill=NAVY)
        _centered(draw, bx + card_w / 2, y + 14, f'#{val}', F_BOLD(36), GOLD)
        _centered(draw, bx + card_w / 2, y + 60, label, F_MED(18), WHITE)
        bx += card_w + 20
    y += 130

    draw.rounded_rectangle([60, y, W - 60, y + 160], radius=20, fill=WHITE, outline=LINE, width=2)
    draw.text((90, y + 24), 'GPA', font=F_MED(20), fill=SLATE)
    draw.text((90, y + 50), f'{center.center_gpa}', font=F_MONO(56), fill=NAVY)
    if center.grade_label:
        draw.text((90, y + 118), f'Daraja {center.grade_letter} · {center.grade_label}', font=F_MED(18), fill=SLATE)
    draw.text((580, y + 24), 'Kufaulu', font=F_MED(20), fill=SLATE)
    draw.text((580, y + 50), f'{center.pass_rate}%', font=F_MONO(56), fill=GREEN)
    graded = center.div_1_total + center.div_2_total + center.div_3_total + center.div_4_total + center.div_0_total
    draw.text((580, y + 118), f'{graded} watahiniwa', font=F_MED(18), fill=SLATE)
    y += 190

    draw.text((60, y), 'Mgawanyo wa Madaraja', font=F_BOLD(22), fill=NAVY)
    y += 36
    divisions = {'I': center.div_1_total, 'II': center.div_2_total, 'III': center.div_3_total,
                 'IV': center.div_4_total, '0': center.div_0_total}
    _division_bar(draw, 60, y, W - 120, 36, divisions, graded)
    y += 56
    dx = 60
    for key in ['I', 'II', 'III', 'IV', '0']:
        draw.ellipse([dx, y, dx + 16, y + 16], fill=DIVISION_COLORS[key])
        draw.text((dx + 24, y - 2), f'Div {key}: {divisions[key]}', font=F_MED(16), fill=SLATE)
        dx += 190
    y += 60

    draw.text((60, y), 'Wavulana dhidi ya Wasichana', font=F_BOLD(22), fill=NAVY)
    y += 44
    _gender_bars(draw, 60, y, W - 120, center.pass_rate_male or 0, center.pass_rate_female or 0)

    _footer(draw, W, H, f'skulinode.co.tz/necta/shule/{center.center_id}')
    return _png(img)


def generate_region_card(region_row, top_schools, level, year):
    W, H = 1080, 1350
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{level} {year}', 'Fahari ya Mkoa', img)

    y = 180
    draw.text((60, y), region_row['region'], font=F_DISPLAY(48), fill=NAVY)
    y += 70
    draw.rounded_rectangle([60, y, W - 60, y + 110], radius=18, fill=NAVY)
    _centered(draw, W / 2, y + 20, f'Nafasi ya {region_row["national_rank"]} Kitaifa', F_BOLD(30), GOLD)
    _centered(draw, W / 2, y + 62, f'{region_row["school_count"]} shule zilizochambuliwa', F_MED(18), WHITE)
    y += 140

    draw.rounded_rectangle([60, y, W - 60, y + 150], radius=20, fill=WHITE, outline=LINE, width=2)
    draw.text((90, y + 24), 'GPA ya Mkoa', font=F_MED(20), fill=SLATE)
    draw.text((90, y + 50), f'{region_row["weighted_gpa"]}', font=F_MONO(52), fill=NAVY)
    draw.text((580, y + 24), 'Kufaulu', font=F_MED(20), fill=SLATE)
    draw.text((580, y + 50), f'{region_row["pass_rate"]}%', font=F_MONO(52), fill=GREEN)
    y += 180

    draw.text((60, y), 'Shule Bora Mkoa Huu', font=F_BOLD(24), fill=NAVY)
    y += 44
    for i, s in enumerate(top_schools[:5], 1):
        draw.text((60, y), f'{i}.', font=F_BOLD(20), fill=SLATE)
        draw.text((100, y), s['center_name'][:34], font=F_MED(20), fill=INK)
        gw = _text_w(draw, str(s['gpa']), F_MONO(20))
        draw.text((W - 100 - gw, y), str(s['gpa']), font=F_MONO(20), fill=NAVY)
        y += 42

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)


def generate_gem_card(gem, level, year):
    W, H = 1080, 1080
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{level} {year}', 'Kito Kilichofichika', img)

    y = 200
    _centered(draw, W / 2, y, '💎', F_DISPLAY(70), GOLD)
    y += 110
    _centered(draw, W / 2, y, gem['center_name'], F_DISPLAY(38), NAVY)
    y += 60
    loc = gem['region'] + (f' · {gem["district"]}' if gem.get('district') else '')
    _centered(draw, W / 2, y, loc, F_MED(22), SLATE)
    y += 80

    draw.rounded_rectangle([140, y, W - 140, y + 200], radius=24, fill=NAVY)
    _centered(draw, W / 2, y + 24, f'GPA {gem["center_gpa"]}', F_MONO(48), GOLD)
    _centered(draw, W / 2, y + 90, f'#{gem["national_rank"]} Kitaifa', F_BOLD(26), WHITE)
    _centered(draw, W / 2, y + 138, f'Watahiniwa {gem["sat_total"]} tu!', F_MED(20), GOLD_SOFT)
    y += 240
    _centered(draw, W / 2, y, 'Shule ndogo iliyowashinda wote', F_MED(22), SLATE)

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)


def generate_gender_card(national, by_region, level, year):
    W, H = 1080, 1200
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{level} {year}', 'Kina Nani Wanaongoza?', img)

    y = 190
    leader_label = 'Wavulana' if national['leader'] == 'MALE' else 'Wasichana'
    _centered(draw, W / 2, y, f'{leader_label} Wanaongoza', F_DISPLAY(36), NAVY)
    y += 60
    _centered(draw, W / 2, y, f'kwa Tofauti ya {national["gap"]}%', F_MED(24), SLATE)
    y += 90

    box_w = 420
    draw.rounded_rectangle([60, y, 60 + box_w, y + 180], radius=20,
                           fill=BLUE_MID if national['leader'] == 'MALE' else WHITE, outline=LINE, width=2)
    _centered(draw, 60 + box_w / 2, y + 30, f'{national["pass_rate_male"]}%', F_MONO(46),
              WHITE if national['leader'] == 'MALE' else BLUE_MID)
    _centered(draw, 60 + box_w / 2, y + 110, 'Wavulana', F_MED(22), WHITE if national['leader'] == 'MALE' else SLATE)

    draw.rounded_rectangle([W - 60 - box_w, y, W - 60, y + 180], radius=20,
                           fill=PINK if national['leader'] == 'FEMALE' else WHITE, outline=LINE, width=2)
    _centered(draw, W - 60 - box_w / 2, y + 30, f'{national["pass_rate_female"]}%', F_MONO(46),
              WHITE if national['leader'] == 'FEMALE' else PINK)
    _centered(draw, W - 60 - box_w / 2, y + 110, 'Wasichana', F_MED(22), WHITE if national['leader'] == 'FEMALE' else SLATE)
    y += 220

    draw.text((60, y), 'Mikoa Yenye Tofauti Kubwa', font=F_BOLD(24), fill=NAVY)
    y += 44
    for r in by_region[:5]:
        draw.text((60, y), r['region'], font=F_MED(20), fill=INK)
        tag = f"Wavulana +{r['gap']}%" if r['gap'] > 0 else f"Wasichana +{abs(r['gap'])}%"
        tw = _text_w(draw, tag, F_BOLD(18))
        draw.text((W - 60 - tw, y), tag, font=F_BOLD(18), fill=BLUE_MID if r['gap'] > 0 else PINK)
        y += 40

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)


def generate_subject_card(subject, rows, level, year, scope_label):
    W, H = 1080, 1350
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{level} {year}', 'Shule Bora Kwa Somo', img)

    y = 180
    draw.text((60, y), subject, font=F_DISPLAY(38), fill=NAVY)
    y += 50
    draw.text((60, y), scope_label, font=F_MED(20), fill=SLATE)
    y += 70

    medals = ['🥇', '🥈', '🥉']
    for i, r in enumerate(rows[:8]):
        marker = medals[i] if i < 3 else f'#{r["rank"]}'
        draw.text((60, y), marker, font=F_BOLD(24), fill=GOLD if i < 3 else SLATE)
        draw.text((160, y), r['center_name'][:32], font=F_MED(22), fill=INK)
        gw = _text_w(draw, str(r['subject_gpa']), F_MONO(22))
        draw.text((W - 60 - gw, y), str(r['subject_gpa']), font=F_MONO(22), fill=NAVY)
        y += 52

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)


def generate_compare_card(schools, level, year):
    n = len(schools)
    W, row_h = 1080, 160
    H = 260 + row_h * n + 100
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{level} {year}', 'Ulinganisho wa Shule', img)

    y = 170
    max_gpa = max((s['gpa'] or 0) for s in schools) or 1
    bar_max_w = W - 400

    for s in schools:
        draw.text((60, y), s['center_name'][:30], font=F_BOLD(22), fill=NAVY)
        draw.text((60, y + 32), s['region'], font=F_MED(16), fill=SLATE)

        bw = (s['gpa'] / max_gpa) * bar_max_w if s['gpa'] else 0
        by = y + 62
        draw.rounded_rectangle([60, by, 60 + bar_max_w, by + 30], radius=8, fill=LINE)
        if bw > 0:
            draw.rounded_rectangle([60, by, 60 + bw, by + 30], radius=8, fill=NAVY)
        draw.text((60 + bar_max_w + 16, by + 2), f'{s["gpa"]}', font=F_MONO(26), fill=NAVY)

        draw.text((60, y + 106), f'#{s["national_rank"]} Taifa · Kufaulu {s["pass_rate"]}%', font=F_MED(18), fill=SLATE)
        y += row_h
        draw.line([60, y - 20, W - 60, y - 20], fill=LINE, width=1)

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)



def generate_head_to_head_card(school_a, school_b, session, best_subject_a=None, best_subject_b=None):
    """
    Football-style head-to-head card for exactly two schools. Center column
    shows the stat label; left/right sides show each school's value with a
    proportional bar from the center divider — the side with the better
    value (per that stat's direction) is drawn brighter, the other muted.
    """
    def _graded_total(c):
        return c.div_1_total + c.div_2_total + c.div_3_total + c.div_4_total + c.div_0_total

    graded_a, graded_b = _graded_total(school_a), _graded_total(school_b)
    div1_rate_a = round(school_a.div_1_total / graded_a * 100, 1) if graded_a else None
    div1_rate_b = round(school_b.div_1_total / graded_b * 100, 1) if graded_b else None

    rows = [
        {'label': 'GPA', 'a': school_a.center_gpa, 'b': school_b.center_gpa,
         'direction': 'lower_better', 'fmt': lambda v: f'{v}' if v is not None else '-'},
        {'label': 'Kufaulu', 'a': school_a.pass_rate, 'b': school_b.pass_rate,
         'direction': 'higher_better', 'fmt': lambda v: f'{v}%' if v is not None else '-'},
        {'label': 'Div I', 'a': div1_rate_a, 'b': div1_rate_b,
         'direction': 'higher_better', 'fmt': lambda v: f'{v}%' if v is not None else '-'},
        {'label': 'Nafasi Kitaifa', 'a': school_a.national_rank, 'b': school_b.national_rank,
         'direction': 'lower_better', 'fmt': lambda v: f'#{v}' if v is not None else '-'},
        {'label': 'Wavulana Kufaulu', 'a': school_a.pass_rate_male, 'b': school_b.pass_rate_male,
         'direction': 'higher_better', 'fmt': lambda v: f'{v}%' if v is not None else '-'},
        {'label': 'Wasichana Kufaulu', 'a': school_a.pass_rate_female, 'b': school_b.pass_rate_female,
         'direction': 'higher_better', 'fmt': lambda v: f'{v}%' if v is not None else '-'},
        {'label': 'Watahiniwa', 'a': school_a.sat_total, 'b': school_b.sat_total,
         'direction': 'neutral', 'fmt': lambda v: f'{v}' if v is not None else '-'},
    ]

    W = 1080
    header_h, title_block_h, row_h, footer_h = 130, 190, 130, 100
    subject_block_h = 140 if (best_subject_a or best_subject_b) else 0
    H = header_h + title_block_h + row_h * len(rows) + subject_block_h + footer_h + 40

    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{session.exam_level} {session.year}', 'Linganisha Moja kwa Moja',img)

    y = header_h + 20
    bar_w = (W - 160) / 2
    center_x = W / 2

    # Fit names dynamically to available side column width (minus padding)
    max_name_w = bar_w - 20
    name_a = _fit_school_name(draw, school_a.center_name, max_name_w, F_BOLD(24))
    name_b = _fit_school_name(draw, school_b.center_name, max_name_w, F_BOLD(24))

    _centered(draw, 80 + bar_w / 2, y, name_a[:22], F_BOLD(24), NAVY)
    _centered(draw, W - 80 - bar_w / 2, y, name_b[:22], F_BOLD(24), NAVY)
    _centered(draw, center_x, y + 6, 'VS', F_DISPLAY(30), GOLD)
    y += 46
    _centered(draw, 80 + bar_w / 2, y, school_a.region, F_MED(16), SLATE)
    _centered(draw, W - 80 - bar_w / 2, y, school_b.region, F_MED(16), SLATE)
    y += 60

    draw.line([60, y, W - 60, y], fill=LINE, width=2)
    y += 30

    for row in rows:
        val_a, val_b, direction = row['a'], row['b'], row['direction']

        _centered(draw, center_x, y, row['label'], F_MED(20), SLATE)
        _centered(draw, 80 + bar_w / 2, y, row['fmt'](val_a), F_BOLD(26), NAVY)
        _centered(draw, W - 80 - bar_w / 2, y, row['fmt'](val_b), F_BOLD(26), NAVY)
        y += 40

        winner = None
        if val_a is not None and val_b is not None and direction != 'neutral':
            if direction == 'lower_better':
                winner = 'a' if val_a < val_b else ('b' if val_b < val_a else None)
            else:
                winner = 'a' if val_a > val_b else ('b' if val_b > val_a else None)

        color_a = GOLD if winner == 'a' else LINE
        color_b = GOLD if winner == 'b' else LINE

        def _strength(v):
            if v is None:
                return 0
            return v if direction != 'lower_better' else (1 / v if v > 0 else 0)

        sa, sb = _strength(val_a), _strength(val_b)
        total = sa + sb
        frac_a = (sa / total) if total > 0 else 0.5
        frac_b = (sb / total) if total > 0 else 0.5

        bar_h = 18
        left_len = frac_a * bar_w
        draw.rounded_rectangle([center_x - 20 - left_len, y, center_x - 20, y + bar_h], radius=9, fill=color_a)
        right_len = frac_b * bar_w
        draw.rounded_rectangle([center_x + 20, y, center_x + 20 + right_len, y + bar_h], radius=9, fill=color_b)
        y += row_h - 40 - bar_h

    if best_subject_a or best_subject_b:
        y += 10
        draw.line([60, y, W - 60, y], fill=LINE, width=1)
        y += 24
        _centered(draw, center_x, y, 'Somo Bora Zaidi', F_MED(20), SLATE)
        y += 40
        if best_subject_a:
            _centered(draw, 80 + bar_w / 2, y, best_subject_a['subject_name'], F_BOLD(20), NAVY)
            _centered(draw, 80 + bar_w / 2, y + 30, f'GPA {best_subject_a["subject_gpa"]}', F_MONO(18), GREEN)
        if best_subject_b:
            _centered(draw, W - 80 - bar_w / 2, y, best_subject_b['subject_name'], F_BOLD(20), NAVY)
            _centered(draw, W - 80 - bar_w / 2, y + 30, f'GPA {best_subject_b["subject_gpa"]}', F_MONO(18), GREEN)

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)



def generate_subject_performance_card(center, session, subjects_with_ranks):
    """
    subjects_with_ranks: list of dicts with subject_name, subject_gpa,
    national_subject_rank (or None), sorted best-GPA-first.
    """
    W = 1080
    row_h = 90
    H = 320 + row_h * min(len(subjects_with_ranks), 10) + 100

    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, f'{session.exam_level} {session.year}', 'Ufaulu wa Masomo',img)

    y = 170
    draw.text((60, y), center.center_name, font=F_DISPLAY(36), fill=NAVY)
    y += 50
    draw.text((60, y), f'{center.region}{" · " + center.district if center.district else ""}',
              font=F_MED(20), fill=SLATE)
    y += 60

    draw.line([60, y, W - 60, y], fill=LINE, width=2)
    y += 30

    medals = ['🥇', '🥈', '🥉']
    for i, s in enumerate(subjects_with_ranks[:10]):
        rank = s.get('national_subject_rank')
        marker = medals[i] if i < 3 and rank and rank <= 3 else (f'#{rank}' if rank else '')

        draw.text((60, y), s['subject_name'], font=F_BOLD(24), fill=INK)
        if marker:
            draw.text((60, y + 32), f'{marker} Kitaifa' if not marker.startswith('#') else f'{marker} Kitaifa',
                      font=F_MED(16), fill=GOLD if i < 3 else SLATE)

        gpa_text = f"{s['subject_gpa']}"
        gw = _text_w(draw, gpa_text, F_MONO(32))
        draw.text((W - 100 - gw, y + 5), gpa_text, font=F_MONO(32), fill=NAVY)
        draw.text((W - 100 - gw, y + 45), 'GPA', font=F_MED(14), fill=SLATE)

        y += row_h
        draw.line([60, y - 20, W - 60, y - 20], fill=LINE, width=1)

    _footer(draw, W, H, f'skulinode.co.tz/necta')
    return _png(img)


# def generate_trend_card(center_name, trend_points, level):
#     """
#     trend_points: [{"year": int, "gpa": float, "national_rank": int|None}, ...]
#     sorted ascending by year. Draws a simple line trend — lower GPA is
#     better, so the chart is visually inverted (lower GPA plots higher).
#     """
#     W, H = 1080, 700
#     img = Image.new('RGB', (W, H), PAPER)
#     draw = ImageDraw.Draw(img)
#     _header(draw, W, level, 'Mwenendo wa Miaka',img)

#     y = 170
#     draw.text((60, y), center_name, font=F_DISPLAY(34), fill=NAVY)
#     y += 70

#     if len(trend_points) < 2:
#         draw.text((60, y), 'Takwimu za mwaka mmoja tu zinapatikana kwa sasa.',
#                   font=F_MED(22), fill=SLATE)
#         _footer(draw, W, H, 'skulinode.co.tz/necta')
#         return _png(img)

#     gpas = [p['gpa'] for p in trend_points if p['gpa'] is not None]
#     min_gpa, max_gpa = min(gpas), max(gpas)
#     gpa_range = max(max_gpa - min_gpa, 0.1)

#     chart_x0, chart_x1 = 100, W - 100
#     chart_y0, chart_y1 = y + 30, y + 260  # y0 = top (better/lower GPA), y1 = bottom (worse/higher GPA)
#     n = len(trend_points)
#     step_x = (chart_x1 - chart_x0) / max(n - 1, 1)

#     points_px = []
#     for i, p in enumerate(trend_points):
#         px = chart_x0 + step_x * i
#         # Inverted: lower GPA -> higher on chart (closer to chart_y0)
#         frac = (p['gpa'] - min_gpa) / gpa_range if p['gpa'] is not None else 0.5
#         py = chart_y0 + frac * (chart_y1 - chart_y0)
#         points_px.append((px, py))

#     # Draw connecting line
#     for i in range(len(points_px) - 1):
#         draw.line([points_px[i], points_px[i + 1]], fill=BLUE_MID, width=4)

#     # Draw points + labels
#     for i, (px, py) in enumerate(points_px):
#         p = trend_points[i]
#         draw.ellipse([px - 10, py - 10, px + 10, py + 10], fill=GOLD, outline=NAVY, width=2)
#         _centered(draw, px, py - 45, str(p['year']), F_BOLD(20), SLATE)
#         _centered(draw, px, py + 20, f"{p['gpa']}", F_MONO(22), NAVY)

#     y = chart_y1 + 60
#     draw.line([60, y, W - 60, y], fill=LINE, width=1)
#     y += 30

#     # Summary arrow: first vs last year
#     first_gpa, last_gpa = trend_points[0]['gpa'], trend_points[-1]['gpa']
#     if first_gpa is not None and last_gpa is not None:
#         improved = last_gpa < first_gpa
#         arrow = '📈' if improved else ('📉' if last_gpa > first_gpa else '➡️')
#         color = GREEN if improved else (G_RED if last_gpa > first_gpa else SLATE)
#         change = round(abs(first_gpa - last_gpa), 2)
#         verb = 'imeimarika' if improved else ('imeshuka' if last_gpa > first_gpa else 'imesalia sawa')
#         _centered(draw, W / 2, y, f'{arrow} GPA {verb} kwa {change} tangu {trend_points[0]["year"]}',
#                   F_BOLD(24), color)

#     _footer(draw, W, H, 'skulinode.co.tz/necta')
#     return _png(img)


def generate_trend_card(center_name, trend_points, level):
    """
    trend_points: [{"year": int, "gpa": float, "national_rank": int|None}, ...]
    sorted ascending by year. Draws a simple line trend — lower GPA is
    better, so the chart is visually inverted (lower GPA plots higher).
    """
    W, H = 1080, 700
    img = Image.new('RGB', (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    _header(draw, W, level, 'Mwenendo wa Miaka', img)

    y = 150
    draw.text((60, y), center_name, font=F_DISPLAY(34), fill=NAVY)
    y += 55

    if len(trend_points) < 2:
        draw.text((60, y), 'Takwimu za mwaka mmoja tu zinapatikana kwa sasa.',
                  font=F_MED(22), fill=SLATE)
        _footer(draw, W, H, 'skulinode.co.tz/necta')
        return _png(img)

    gpas = [p['gpa'] for p in trend_points if p['gpa'] is not None]
    min_gpa, max_gpa = min(gpas), max(gpas)
    gpa_range = max(max_gpa - min_gpa, 0.1)

    chart_x0, chart_x1 = 100, W - 100
    # Adjusted chart y-range to save vertical space (220px high instead of 230px)
    chart_y0, chart_y1 = y + 40, y + 240 
    n = len(trend_points)
    step_x = (chart_x1 - chart_x0) / max(n - 1, 1)

    points_px = []
    for i, p in enumerate(trend_points):
        px = chart_x0 + step_x * i
        # Inverted: lower GPA -> higher on chart (closer to chart_y0)
        frac = (p['gpa'] - min_gpa) / gpa_range if p['gpa'] is not None else 0.5
        py = chart_y0 + frac * (chart_y1 - chart_y0)
        points_px.append((px, py))

    # Draw connecting line
    for i in range(len(points_px) - 1):
        draw.line([points_px[i], points_px[i + 1]], fill=BLUE_MID, width=4)

    # Draw points + labels
    for i, (px, py) in enumerate(points_px):
        p = trend_points[i]
        draw.ellipse([px - 10, py - 10, px + 10, py + 10], fill=GOLD, outline=NAVY, width=2)
        _centered(draw, px, py - 40, str(p['year']), F_BOLD(20), SLATE)
        _centered(draw, px, py + 20, f"{p['gpa']}", F_MONO(22), NAVY)

    # Tightened divider spacing
    y = chart_y1 + 45
    draw.line([60, y, W - 60, y], fill=LINE, width=1)
    y += 25

    # Summary arrow: first vs last year
    first_gpa, last_gpa = trend_points[0]['gpa'], trend_points[-1]['gpa']
    if first_gpa is not None and last_gpa is not None:
        improved = last_gpa < first_gpa
        arrow = '📈' if improved else ('📉' if last_gpa > first_gpa else '➡️')
        RED = (220, 38, 38)
        color = GREEN if improved else (RED if last_gpa > first_gpa else SLATE)
        change = round(abs(first_gpa - last_gpa), 2)
        verb = 'imeimarika' if improved else ('imeshuka' if last_gpa > first_gpa else 'imesalia sawa')
        _centered(draw, W / 2, y, f'{arrow} GPA {verb} kwa {change} tangu {trend_points[0]["year"]}',
                  F_BOLD(24), color)

    _footer(draw, W, H, 'skulinode.co.tz/necta')
    return _png(img)