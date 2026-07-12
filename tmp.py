def print_hex(text,hex_color):
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)

    print(f"\033[38;2;{r};{g};{b}m{text}\033[0m",end='') 


for i in [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F']:
    for j in [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F']:
        print_hex(j,"#"+str(j)+str(j)+str(i)+str(j)+str(i)+str(j))
    print('')